import json
import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

class HttpClientError(Exception):
    """Domain-specific HTTP error with safe, non-secret details."""

    def __init__(self, *, service: str, status_code: int, message: str) -> None:
        self.service = service
        self.status_code = status_code
        super().__init__(f"[{service}] HTTP {status_code}: {message}")


async def _read_json_safely(
    response: httpx.Response, *, service: str
) -> Any:
    """
    Defensive JSON parsing similar to `readJsonOrThrow` in the TS backend.

    - Reads the body as text first.
    - Strips BOM / anti-XSSI prefixes.
    - Raises HttpClientError with a short, non-sensitive preview on failure.
    """
    content_type = response.headers.get("content-type", "")
    raw = response.text
    trimmed = raw.lstrip("\ufeff").strip()

    if not response.is_success:
        # Truncate body preview to avoid log/response bloat and PII leaks.
        preview = trimmed[:300]
        raise HttpClientError(
            service=service,
            status_code=response.status_code,
            message=f"content-type={content_type} body={preview}",
        )

    if not trimmed:
        return None

    # Common anti-XSSI prefixes
    cleaned = trimmed
    if cleaned.startswith(")]}',"):
        cleaned = cleaned[5:].lstrip()
    if cleaned.startswith("null") and cleaned != "null":
        # Strip a leading 'null' only when additional JSON content follows.
        cleaned = cleaned[4:].lstrip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        preview = cleaned[:200]
        raise HttpClientError(
            service=service,
            status_code=response.status_code,
            message=f"json-parse-failed content-type={content_type} first200={preview} err={exc}",
        ) from exc


def create_commerce7_client() -> httpx.AsyncClient:
    """
    Factory for a hardened AsyncClient configured for Commerce7.
    Credentials are injected per-request; this only sets timeouts and TLS.
    """
    return httpx.AsyncClient(
        base_url=settings.COMMERCE7_BASE_URL,
        timeout=httpx.Timeout(20.0, connect=5.0),
        follow_redirects=False,
    )


def _normalize_vintrace_base(base_url: Optional[str]) -> Optional[str]:
    if not base_url:
        return base_url
    normalized = base_url.rstrip("/")
    for marker in ("/api/v6", "/api/v7"):
        if marker in normalized:
            normalized = normalized.split(marker, 1)[0]
            break
    return normalized or base_url


def create_vintrace_client(base_url: Optional[str] = None) -> httpx.AsyncClient:
    """
    Factory for a hardened AsyncClient configured for Vintrace.
    """
    final_base = _normalize_vintrace_base(base_url or settings.VINTRACE_BASE_URL)
    return httpx.AsyncClient(
        base_url=final_base or "",
        timeout=httpx.Timeout(30.0, connect=5.0),
        follow_redirects=False,
    )


async def commerce7_request(
    client: httpx.AsyncClient,
    path: str,
    *,
    method: str = "GET",
    json_body: Optional[Dict[str, Any]] = None,
    attempt: int = 0,
    max_attempts: int = 6,
) -> Any:
    """
    Secure wrapper around Commerce7 API calls with:
    - Basic auth using COMMERCE7_API_KEY.
    - Tenant header.
    - Limit-capping (<= 50) on `limit` query parameter.
    - Smart 429 retry with backoff.
    """
    if not settings.COMMERCE7_API_KEY or not settings.COMMERCE7_TENANT_ID:
        raise RuntimeError("Commerce7 API credentials not configured")

    # Enforce limit <= 50 if present
    final_path = settings.COMMERCE7_BASE_URL + path
    # naive but safe regex-free capping
    if "limit=" in path:
        # split on '&' and rebuild
        parts = []
        for segment in path.split("&"):
            if "limit=" in segment:
                key, value = segment.split("limit=", 1)
                try:
                    requested = int(value.split("&", 1)[0])
                except ValueError:
                    requested = 50
                capped = min(requested, 50)
                segment = f"{key}limit={capped}"
            parts.append(segment)
        final_path = "&".join(parts)

    url = final_path
    basic_auth = httpx.BasicAuth("dash", settings.COMMERCE7_API_KEY)
    print(f"COMMERCE7url: {url}")
    headers = {
        "tenant": settings.COMMERCE7_TENANT_ID,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    print(f"COMMERCE7head: {headers}")
    print(f"COMMERCE7tenatn: {settings.COMMERCE7_TENANT_ID}")
    print(f"COMMERCE7: {settings.COMMERCE7_API_KEY}")

    try:
        print()
        response = await client.request(
            method,
            url,
            headers=headers,
            auth=basic_auth,
            json=json_body,
        )
    except httpx.RequestError as exc:
        # Network / DNS / TLS failures
        raise HttpClientError(
            service="commerce7",
            status_code=0,
            message=str(exc),
        ) from exc

    # Handle rate limiting with backoff + Retry-After
    if response.status_code == 429 and attempt < max_attempts:
        retry_after = response.headers.get("retry-after")
        if retry_after is not None:
            try:
                delay = max(0.25, float(retry_after))
            except ValueError:
                delay = 0.5 * (2 ** attempt)
        else:
            delay = min(10.0, 0.5 * (2 ** attempt))

        import asyncio

        await asyncio.sleep(delay)
        return await commerce7_request(
            client,
            path,
            method=method,
            json_body=json_body,
            attempt=attempt + 1,
            max_attempts=max_attempts,
        )

    return await _read_json_safely(response, service="commerce7")


async def vintrace_request(
    client: httpx.AsyncClient,
    path: str,
    *,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
) -> Any:
    """
    Secure wrapper around Vintrace API calls using Bearer auth.
    """
    if not settings.VINTRACE_API_KEY or not settings.VINTRACE_BASE_URL:
        raise RuntimeError("Vintrace API credentials not configured")

    headers = {
        "Authorization": f"Bearer {settings.VINTRACE_API_KEY}",
        "Accept": "application/json",
        "correlation-id": "",
    }

    start = time.monotonic()
    try:
        response = await client.request(method, path, headers=headers, params=params)
    except httpx.RequestError as exc:
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        logger.warning(
            "vintrace request failed method=%s path=%s params=%s elapsed_ms=%s err=%s",
            method,
            path,
            params,
            elapsed_ms,
            str(exc),
        )
        raise HttpClientError(
            service="vintrace",
            status_code=0,
            message=str(exc),
        ) from exc

    elapsed_ms = round((time.monotonic() - start) * 1000, 2)
    logger.info(
        "vintrace response status=%s method=%s path=%s params=%s elapsed_ms=%s base=%s",
        response.status_code,
        method,
        path,
        params,
        elapsed_ms,
        _normalize_vintrace_base(settings.VINTRACE_BASE_URL),
    )
    return await _read_json_safely(response, service="vintrace")
