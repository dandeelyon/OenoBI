import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext"; // Import useAuth

export interface DashExecPayload {
  overview: {
    revenue: {
      last30Days: number;
      last90Days: number;
      dailyAvg30d: number;
      dailyAvg90d: number;
    };
    orders: {
      last30Days: number;
      last90Days: number;
    };
    inventory: {
      totalBottles: number;
      totalProducts: number;
    };
  };
  topMovers: Array<{
    sku: string;
    quantity: number;
    revenue: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
  customerAnalytics?: {
    topCustomers90d: Array<{
      customerId: string;
      name: string;
      email: string;
      revenue90d: number;
      orders90d: number;
      bottles90d: number;
    }>;
    newCustomers30d: Array<{
      customerId: string;
      name: string;
      email: string;
      firstOrderDate: string;
      firstOrderRevenue: number;
    }>;
    topLtv: Array<{
      customerId: string;
      name: string;
      email: string;
      revenue120d: number;
      orders120d: number;
      bottles120d: number;
      ltvWindowDays: number;
    }>;
    debug?: {
      customerIdsInOrders90d: number;
      customersResolved: number;
      customersMissing: number;
      customerFetchPages: number;
    };
  };
  meta: {
    computedAt: string;
    cacheStatus?: string;
    cacheAge?: number;
    ordersCount?: number;
    productsCount?: number;
  };
}

// Validation: ensure payload has required shape
function isValidDashExecPayload(x: any): x is DashExecPayload {
  return (
    !!x &&
    typeof x === "object" &&
    x.overview &&
    x.overview.revenue &&
    typeof x.overview.revenue.last30Days === "number" &&
    typeof x.overview.revenue.last90Days === "number" &&
    x.overview.orders &&
    typeof x.overview.orders.last30Days === "number" &&
    typeof x.overview.orders.last90Days === "number" &&
    x.overview.inventory &&
    typeof x.overview.inventory.totalBottles === "number" &&
    typeof x.overview.inventory.totalProducts === "number" &&
    Array.isArray(x.topMovers) &&
    Array.isArray(x.monthlyTrend)
  );
}

// Safe fallback payload (never let {} into state)
function makeEmptyDashExecPayload(): DashExecPayload {
  return {
    overview: {
      revenue: { last30Days: 0, last90Days: 0, dailyAvg30d: 0, dailyAvg90d: 0 },
      orders: { last30Days: 0, last90Days: 0 },
      inventory: { totalBottles: 0, totalProducts: 0 },
    },
    topMovers: [],
    monthlyTrend: [],
    meta: { cacheStatus: "empty_default", computedAt: new Date().toISOString() },
  };
}

type CacheEntry = {
  key: string;
  promise?: Promise<DashExecPayload>;
  data?: DashExecPayload;
  error?: string;
  ts?: number;
};

const CACHE: CacheEntry = { key: "" };
const CLIENT_TTL_MS = 0; // TEMP: Set to 0 during debugging to always fetch fresh

function makeKey() {
  // Cache key v1: simple order totals
  return `dash-exec::v1`;
}

export function useDashExec() {
  const [data, setData] = useState<DashExecPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We no longer need `isAuthenticated` directly here for token retrieval
  // but it's fine to keep if used elsewhere for UI logic.
  const { isAuthenticated } = useAuth(); // Keeping this for potential future use or debugging if needed

  const cacheKey = useMemo(() => makeKey(), []);

  const refresh = async () => {
    console.log('🔄 [DashExec] Manual refresh requested - clearing cache...');
    console.log('🔄 [DashExec] Current cache key:', CACHE.key);
    
    // Clear client cache
    CACHE.key = "";
    CACHE.promise = undefined;
    CACHE.data = undefined;
    CACHE.error = undefined;
    CACHE.ts = undefined;
    
    console.log('🔄 [DashExec] Client cache cleared');
    
    // Force server refresh using POST to the correct endpoint
    try {
      const refreshUrl = `${import.meta.env.VITE_BACKEND_URL}/backend-api/dash/exec/refresh`;
      console.log('🔄 [DashExec] Fetching with refresh flag (POST):', refreshUrl);
      
      const authToken = localStorage.getItem('authToken'); // Get fresh token here
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const resp = await fetch(refreshUrl, {
        method: "POST",
        headers: headers,
      });
      
      console.log('🔄 [DashExec] Response status:', resp.status);
      
      if (resp.ok) {
        const payload = await resp.json();
        console.log('🔄 [DashExec] Server cache refreshed, received new data');
        if (isValidDashExecPayload(payload)) {
          setData(payload);
          setLoading(false);
          return;
        }
      }
      console.log('🔄 [DashExec] Server refresh completed');
    } catch (e) {
      console.error('🔄 [DashExec] Failed to force refresh:', e);
    }
    
    // Trigger a re-fetch by updating state
    setLoading(true);
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      // If cache matches and is fresh, serve immediately
      if (
        CACHE.key === cacheKey &&
        CACHE.data &&
        CACHE.ts &&
        Date.now() - CACHE.ts < CLIENT_TTL_MS
      ) {
        if (!cancelled) {
          setData(CACHE.data);
          setLoading(false);
        }
        return;
      }

      // If there is an in-flight request for this key, await it (dedupe)
      if (CACHE.key === cacheKey && CACHE.promise) {
        try {
          const result = await CACHE.promise;
          if (!cancelled) {
            setData(result);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message ?? "Failed to load dashboard");
            setLoading(false);
          }
        }
        return;
      }

      // New request
      CACHE.key = cacheKey;
      CACHE.error = undefined;
      CACHE.data = undefined;

      const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/dash/exec`;

      CACHE.promise = (async () => {
        console.log('[DashExec] Fetching dashboard data...');
        
        // Retry logic for 202/503 responses
        let attempt = 0;
        const maxAttempts = 3;
        
        while (attempt < maxAttempts) {
          attempt++;
          
          const authToken = localStorage.getItem('authToken'); // Get fresh token here
          const headers: HeadersInit = {
            "Content-Type": "application/json",
          };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          const resp = await fetch(url, {
            headers: headers,
          });

          // CRITICAL: Check for 202/503 BEFORE resp.ok (202 is technically "ok" but not valid payload)
          
          // Handle 202 Accepted (refresh in progress - warmup, don't set data to {})
          if (resp.status === 202) {
            const body = await resp.json();
            // Prefer Retry-After header (in seconds), fallback to body.retryAfterMs
            const retryAfterHeader = resp.headers.get('Retry-After');
            const retryAfterMs = retryAfterHeader 
              ? parseInt(retryAfterHeader, 10) * 1000 
              : (body.retryAfterMs || 2000);
            console.log(`[DashExec] 202 Accepted - refresh in progress. Retrying in ${retryAfterMs}ms (attempt ${attempt}/${maxAttempts})`);
            
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, retryAfterMs));
              continue;
            }
            throw new Error('Dashboard warmup timed out after maximum retries');
          }

          // Handle 503 Service Unavailable (legacy behavior)
          if (resp.status === 503) {
            const body = await resp.json();
            console.log(`[DashExec] 503 Service Unavailable - retrying (attempt ${attempt}/${maxAttempts})`);
            
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
            throw new Error('Dashboard service unavailable after maximum retries');
          }

          // Success case - validate payload
          if (resp.ok) {
            const json = await resp.json();
            
            // CRITICAL: Validate payload shape before setting state
            if (!isValidDashExecPayload(json.payload)) {
              console.error('[DashExec] Invalid payload shape received:', json.payload);
              throw new Error('Invalid dashboard payload - missing required fields');
            }
            
            console.log('[DashExec] Dashboard data received:', {
              cacheStatus: json.payload.meta?.cacheStatus,
              cacheAge: json.payload.meta?.cacheAge,
              ordersCount: json.payload.meta?.ordersCount
            });
            return json.payload;
          }

          // Other errors
          const text = await resp.text();
          throw new Error(`Dashboard fetch failed: ${resp.status} ${text}`);
        }
        
        // Max attempts reached
        throw new Error(`Dashboard refresh timed out after ${maxAttempts} attempts`);
      })();

      try {
        const result = await CACHE.promise;
        CACHE.data = result;
        CACHE.ts = Date.now();
        CACHE.promise = undefined;

        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (e: any) {
        CACHE.error = e?.message ?? "Failed to load dashboard";
        CACHE.promise = undefined;

        if (!cancelled) {
          setError(CACHE.error);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return { data, loading, error, refresh };
}