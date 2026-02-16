from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

import httpx

from app.config import settings
from app.core.http_client import (
    commerce7_request,
    create_commerce7_client,
)


async def fetch_paged_orders(days_back: int = 180, max_pages: int = 20) -> List[Dict[str, Any]]:
    """
    Fetch recent Commerce7 orders with pagination, stopping at a cutoff date
    similar to `fetchRecentOrdersWithCache` in the TypeScript backend.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    all_orders: List[Dict[str, Any]] = []

    async with create_commerce7_client() as client:
        page = 1
        while page <= max_pages:
            data = await commerce7_request(client, f"/order?page={page}&limit=50")
            orders = data.get("orders") or []
            if not orders:
                break

            all_orders.extend(orders)

            # Oldest order in this page
            oldest = min(
                (
                    _parse_order_date(o)
                    for o in orders
                    if _parse_order_date(o) is not None
                ),
                default=None,
            )
            if oldest and oldest < cutoff:
                break

            page += 1

    return all_orders


async def fetch_all_products(max_pages: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch all Commerce7 products with pagination, similar to the TS backend.
    """
    products: List[Dict[str, Any]] = []

    async with create_commerce7_client() as client:
        page = 1
        while page <= max_pages:
            data = await commerce7_request(client, f"/product?page={page}&limit=50")
            chunk = data.get("products") or []
            if not chunk:
                break

            products.extend(chunk)
            page += 1

    return products


async def fetch_all_customers(max_pages: int = 200) -> List[Dict[str, Any]]:
    """
    Fetch all Commerce7 customers with pagination.
    """
    customers: List[Dict[str, Any]] = []

    async with create_commerce7_client() as client:
        page = 1
        while page <= max_pages:
            data = await commerce7_request(client, f"/customer?page={page}&limit=50")
            chunk = data.get("customers") or []
            if not chunk:
                break
            customers.extend(chunk)
            page += 1

    return customers


async def fetch_selective_customers(
    customer_ids: List[str], max_pages: int = 200
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch only a bounded set of customers by scanning a limited number of pages,
    mirroring the TS `fetchSelectiveCustomers`.
    """
    target_ids = set(customer_ids)
    result: Dict[str, Dict[str, Any]] = {}
    if not target_ids:
        return result

    async with create_commerce7_client() as client:
        page = 1
        while page <= max_pages and len(result) < len(target_ids):
            data = await commerce7_request(client, f"/customer?page={page}&limit=50")
            customers = data.get("customers") or []
            if not customers:
                break

            for c in customers:
                cid = str(c.get("id") or c.get("customerId") or "").strip()
                if cid and cid in target_ids:
                    result[cid] = c
                    if len(result) == len(target_ids):
                        break
            page += 1

    return result


def _parse_order_date(order: Dict[str, Any]) -> datetime | None:
    raw = (
        order.get("orderSubmittedDate")
        or order.get("orderDate")
        or order.get("createdAt")
        or order.get("purchasedAt")
        or order.get("processedAt")
    )
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None

