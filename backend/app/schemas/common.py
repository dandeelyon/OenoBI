from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime

# Schema for the cached dashboard data from kv store
class CachedDashboardData(BaseModel):
    payload: Dict[str, Any] # The actual dashboard payload, type Any for now
    timestamp: datetime # When the cache was generated

# Placeholder for actual DashExecPayload for future use
# from src/hooks/useDashExec.ts
# export interface DashExecPayload {
#   overview: {
#     revenue: {
#       last30Days: number;
#       last90Days: number;
#       dailyAvg30d: number;
#       dailyAvg90d: number;
#     };
#     orders: {
#       last30Days: number;
#       last90Days: number;
#     };
#     inventory: {
#       totalBottles: number;
#       totalProducts: number;
#     };
#   };
#   topMovers: Array<{
#     sku: string;
#     quantity: number;
#     revenue: number;
#   }>;
#   monthlyTrend: Array<{
#     month: string;
#     revenue: number;
#     orders: number;
#     customers: number;
#   }>;
#   customerAnalytics?: {
#     # ... extensive nested structure ...
#   };
#   meta: {
#     computedAt: string;
#     cacheStatus?: string;
#     cacheAge?: number;
#     ordersCount?: number;
#     productsCount?: number;
#   };
# }
