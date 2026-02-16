from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple, Set

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.commerce7_client import (
    fetch_all_products,
    fetch_paged_orders,
    fetch_selective_customers,
)
from app.services.vintrace_client import fetch_inventory


def _get_order_date(order: Dict[str, Any]) -> datetime | None:
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


def _get_line_items(order: Dict[str, Any]) -> List[Dict[str, Any]]:
    for key in ("items", "orderItems", "lineItems"):
        items = order.get(key)
        if isinstance(items, list):
            return items
    if isinstance(order.get("items", {}).get("items"), list):
        return order["items"]["items"]
    return []


def _get_qty(item: Dict[str, Any]) -> int:
    q = item.get("quantity") or item.get("qty") or item.get("count") or 0
    try:
        n = int(q)
    except (TypeError, ValueError):
        return 0
    return n


def _get_variant_id(item: Dict[str, Any]) -> str | None:
    vid = (
        item.get("productVariantId")
        or item.get("variantId")
        or (item.get("variant") or {}).get("id")
    )
    if vid is None:
        return None
    return str(vid).strip() or None


def _resolve_order_sku(
    item: Dict[str, Any],
    sku_by_variant_id: Dict[str, str],
) -> str | None:
    direct = (item.get("sku") or "").strip()
    if direct:
        return direct
    vid = _get_variant_id(item)
    if vid and vid in sku_by_variant_id:
        return sku_by_variant_id[vid]
    return None


def _order_total_dollars(order: Dict[str, Any]) -> float:
    raw = order.get("total") or order.get("grandTotal") or order.get("orderTotal") or 0
    if not isinstance(raw, (int, float)):
        try:
            raw = float(raw)
        except (TypeError, ValueError):
            return 0.0
    # Commerce7 typically uses cents; treat large numbers as cents.
    if abs(raw) >= 1000:
        raw = raw / 100.0
    return max(raw, 0.0)


def _build_sku_maps(
    products: List[Dict[str, Any]],
) -> Tuple[Set[str], Dict[str, float], Dict[str, str], Dict[str, str]]:
    """
    Build curated SKU set and lookup maps, based on Commerce7 products.
    Mirrors the TS `buildSkuMaps` heuristics.
    """
    wine_sku_pattern_prefixes = tuple(settings.COMMERCE7_WINE_SKU_PATTERN_PREFIXES)
    exclude_skus = set(settings.COMMERCE7_EXCLUDE_SKUS)

    curated_skus: Set[str] = set()
    price_by_sku: Dict[str, float] = {}
    title_by_sku: Dict[str, str] = {}
    sku_by_variant_id: Dict[str, str] = {}

    for product in products:
        title = (product.get("title") or "").strip()
        title_lower = title.lower()
        if "twilight" in title_lower:
            continue

        for variant in product.get("variants") or []:
            sku = (variant.get("sku") or "").strip()
            if not sku:
                continue
            sku_lower = sku.lower()
            if sku_lower in exclude_skus:
                continue
            if "et" in sku_lower or "twi" in sku_lower:
                continue
            if not sku.upper().startswith(wine_sku_pattern_prefixes):
                continue

            vol = variant.get("volumeInML")
            if isinstance(vol, (int, float)) and vol > 750:
                continue

            price_cents = variant.get("price")
            if not isinstance(price_cents, (int, float)) or price_cents <= 100:
                continue

            curated_skus.add(sku)
            price_by_sku[sku] = price_cents / 100.0
            title_by_sku[sku] = title or sku

            if variant.get("id") is not None:
                sku_by_variant_id[str(variant["id"])] = sku

    return curated_skus, price_by_sku, title_by_sku, sku_by_variant_id


def _allocate_curated_revenue_for_order(
    order: Dict[str, Any],
    curated_skus: Set[str],
    sku_by_variant_id: Dict[str, str],
    price_by_sku: Dict[str, float],
) -> Dict[str, Any]:
    total = _order_total_dollars(order)
    if total <= 0:
        return {"revenue": 0.0, "bottles": 0, "skuRevenue": {}}

    items = _get_line_items(order)

    curated_lines: List[Dict[str, Any]] = []
    curated_catalog_subtotal = 0.0
    bottles = 0

    for it in items:
        sku = _resolve_order_sku(it, sku_by_variant_id)
        if not sku or sku not in curated_skus:
            continue
        qty = _get_qty(it)
        if qty <= 0:
            continue
        price = price_by_sku.get(sku, 0.0)
        catalog = qty * price
        curated_lines.append({"sku": sku, "qty": qty, "catalog": catalog})
        curated_catalog_subtotal += catalog
        bottles += qty

    if not curated_lines:
        return {"revenue": 0.0, "bottles": 0, "skuRevenue": {}}

    sku_revenue: Dict[str, Dict[str, Any]] = {}
    if curated_catalog_subtotal <= 0:
        total_qty = sum(l["qty"] for l in curated_lines) or 1
        for l in curated_lines:
            alloc = total * (l["qty"] / total_qty)
            entry = sku_revenue.setdefault(
                l["sku"], {"revenue": 0.0, "qty": 0}
            )
            entry["revenue"] += alloc
            entry["qty"] += l["qty"]
        return {"revenue": total, "bottles": bottles, "skuRevenue": sku_revenue}

    for l in curated_lines:
        alloc = total * (l["catalog"] / curated_catalog_subtotal)
        entry = sku_revenue.setdefault(
            l["sku"], {"revenue": 0.0, "qty": 0}
        )
        entry["revenue"] += alloc
        entry["qty"] += l["qty"]

    return {"revenue": total, "bottles": bottles, "skuRevenue": sku_revenue}


async def compute_dashboard_payload(*, days_back: int = 180) -> Dict[str, Any]:
    """
    High-level port of `computeDashboardPayload` from the TS backend.

    - Fetches recent orders and full products from Commerce7.
    - Builds curated SKU set.
    - Computes overview metrics, monthly trend, and top movers.
    - Customer analytics can be added incrementally as needed.
    """
    orders = await fetch_paged_orders(days_back=days_back)
    products = await fetch_all_products()
    vintrace_inventory_data = await fetch_inventory()

    curated_skus, price_by_sku, title_by_sku, sku_by_variant_id = _build_sku_maps(
        products
    )

    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d90 = now - timedelta(days=90)

    orders30 = [o for o in orders if (d := _get_order_date(o)) and d >= d30]
    orders90 = [o for o in orders if (d := _get_order_date(o)) and d >= d90]

    # Curated revenue & bottles over 30/90 days
    rev30 = bottles30 = 0.0
    rev90 = bottles90 = 0.0

    for o in orders30:
        alloc = _allocate_curated_revenue_for_order(
            o, curated_skus, sku_by_variant_id, price_by_sku
        )
        rev30 += alloc["revenue"]
        bottles30 += alloc["bottles"]

    for o in orders90:
        alloc = _allocate_curated_revenue_for_order(
            o, curated_skus, sku_by_variant_id, price_by_sku
        )
        rev90 += alloc["revenue"]
        bottles90 += alloc["bottles"]

    commerce7_total_inventory_bottles = _compute_total_inventory(products)
    commerce7_total_products = len(products)

    vintrace_total_inventory_bottles = _compute_vintrace_total_bottles(vintrace_inventory_data)
    vintrace_total_products = _compute_vintrace_total_products(vintrace_inventory_data)

    overview = {
        "revenue": {
            "last30Days": round(rev30, 2),
            "last90Days": round(rev90, 2),
            "dailyAvg30d": round(rev30 / 30.0, 2),
            "dailyAvg90d": round(rev90 / 90.0, 2),
        },
        "orders": {
            "last30Days": len(orders30),
            "last90Days": len(orders90),
        },
        "inventory": {
            "totalBottles": commerce7_total_inventory_bottles + vintrace_total_inventory_bottles,
            "totalProducts": commerce7_total_products + vintrace_total_products,
        },
    }

    monthly_trend = _compute_monthly_trend(
        orders90, curated_skus, sku_by_variant_id, price_by_sku
    )
    top_movers = _compute_top_movers(
        orders90, curated_skus, sku_by_variant_id, price_by_sku, title_by_sku
    )

    payload: Dict[str, Any] = {
        "overview": overview,
        "topMovers": top_movers,
        "monthlyTrend": monthly_trend,
        "customerAnalytics": None,  # can be populated later if needed
        "meta": {
            "computedAt": now.isoformat() + "Z",
            "ordersCount": len(orders),
            "productsCount": len(products),
            "curatedSkuCount": len(curated_skus),
        },
    }

    return payload


def _compute_total_inventory(products: List[Dict[str, Any]]) -> int:
    total = 0
    for p in products:
        for v in p.get("variants") or []:
            for inv in v.get("inventory") or []:
                total += int(inv.get("availableForSaleCount") or 0)
    return total


def _compute_vintrace_total_bottles(vintrace_data: Dict[str, Any]) -> int:
    total = 0
    items = vintrace_data.get("inventorySummaries") or vintrace_data.get("results") or []
    for item in items:
        total += int(item.get("quantity") or item.get("totalQuantity") or 0)
    return total


def _compute_vintrace_total_products(vintrace_data: Dict[str, Any]) -> int:
    items = vintrace_data.get("inventorySummaries") or vintrace_data.get("results") or []
    # Assuming each item in inventorySummaries/results represents a distinct product
    return len(items)


def _compute_vintrace_total_bottles(vintrace_data: Dict[str, Any]) -> int:
    total = 0
    items = vintrace_data.get("inventorySummaries") or vintrace_data.get("results") or []
    for item in items:
        # Assuming 'quantity' or similar field holds the number of bottles
        total += int(item.get("quantity") or item.get("totalQuantity") or 0)
    return total


def _compute_vintrace_total_products(vintrace_data: Dict[str, Any]) -> int:
    items = vintrace_data.get("inventorySummaries") or vintrace_data.get("results") or []
    return len(items)


def _compute_monthly_trend(
    orders: List[Dict[str, Any]],
    curated_skus: Set[str],
    sku_by_variant_id: Dict[str, str],
    price_by_sku: Dict[str, float],
) -> List[Dict[str, Any]]:
    monthly: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        d = _get_order_date(o)
        if not d:
            continue
        key = f"{d.year}-{d.month:02d}"
        entry = monthly.setdefault(
            key, {"monthKey": key, "revenue": 0.0, "bottles": 0, "orders": 0}
        )
        alloc = _allocate_curated_revenue_for_order(
            o, curated_skus, sku_by_variant_id, price_by_sku
        )
        if alloc["revenue"] > 0 or alloc["bottles"] > 0:
            entry["revenue"] += alloc["revenue"]
            entry["bottles"] += alloc["bottles"]
            entry["orders"] += 1

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    trend = []
    for key, data in monthly.items():
        year, mm = key.split("-")
        label = f"{month_names[int(mm) - 1]} {year}"
        trend.append(
            {
                "month": label,
                "revenue": round(data["revenue"], 2),
                "bottles": data["bottles"],
                "orders": data["orders"],
            }
        )

    trend.sort(key=lambda x: x["month"])
    # Keep last 3 months for the chart, as in TS.
    return trend[-3:]


def _compute_top_movers(
    orders: List[Dict[str, Any]],
    curated_skus: Set[str],
    sku_by_variant_id: Dict[str, str],
    price_by_sku: Dict[str, float],
    title_by_sku: Dict[str, str],
    limit: int = 10,
) -> List[Dict[str, Any]]:
    sku_agg: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        alloc = _allocate_curated_revenue_for_order(
            o, curated_skus, sku_by_variant_id, price_by_sku
        )
        for sku, stats in alloc["skuRevenue"].items():
            entry = sku_agg.setdefault(
                sku,
                {
                    "sku": sku,
                    "productTitle": title_by_sku.get(sku, sku),
                    "quantity": 0,
                    "revenue": 0.0,
                },
            )
            entry["quantity"] += stats["qty"]
            entry["revenue"] += stats["revenue"]

    movers = sorted(
        sku_agg.values(), key=lambda x: x["quantity"], reverse=True
    )[:limit]
    for m in movers:
        m["revenue"] = round(m["revenue"], 2)
    return movers

