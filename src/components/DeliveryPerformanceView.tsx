import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { useEffect, useState } from "react";

interface StockDispatch {
  id: number;
  dispatchType: string;
  dispatchDate: string;
  wineBatch?: {
    id: number;
    name: string;
    vintage?: string;
  };
  product?: {
    id: number;
    name: string;
    code?: string;
  };
  quantity?: number;
  volume?: {
    value: number;
    unit: string;
  };
  [key: string]: any;
}

interface StockDispatchesResponse {
  totalResults: number;
  count: number;
  dispatches: StockDispatch[];
  dispatchTypes: Record<string, number>;
}

export function DeliveryPerformanceView() {
  const [data, setData] = useState<StockDispatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDispatches = async () => {
      setLoading(true);
      setError(null);

      try {
        // First try without year filter to test if endpoint works
        const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/stock-dispatches`;
        
        console.log('[Delivery Performance] Fetching stock dispatches (testing endpoint)...');

        const response = await fetch(url);

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        console.log(`[Delivery Performance] Loaded ${result.dispatches.length} dispatches`);
        console.log('[Delivery Performance] Dispatch types:', result.dispatchTypes);
        
        // Log first few dispatches to understand structure
        if (result.dispatches.length > 0) {
          console.log('[Delivery Performance] Sample dispatch:', result.dispatches[0]);
        }

        setData(result);
      } catch (err) {
        console.error("[Delivery Performance] Error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDispatches();
  }, []);

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <p className="font-semibold">Vintrace API Endpoint Not Available</p>
            <p className="text-sm mt-2">
              The <code className="bg-amber-100 px-1 rounded">/api/v7/stock/dispatches</code> endpoint returned a 404 error.
            </p>
            <p className="text-sm mt-2">
              This endpoint may not exist in your Vintrace API version, or it may require different parameters.
            </p>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer hover:text-amber-700 font-medium">View error details</summary>
              <pre className="mt-2 p-2 bg-amber-100 rounded overflow-auto">
                {error}
              </pre>
            </details>
            <p className="text-sm mt-3 font-medium">
              💡 Suggestion: Check the Vintrace API documentation for the correct endpoint path for stock dispatches or bottling records.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.dispatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Performance (2025)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No dispatch data available for 2025
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group dispatches by type for analysis
  const dispatchTypesList = Object.entries(data.dispatchTypes).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Performance - 2025 Dispatches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Dispatches</p>
              <p className="text-2xl font-bold">{data.totalResults}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Dispatch Types</p>
              <p className="text-2xl font-bold">{Object.keys(data.dispatchTypes).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Types Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Dispatch Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dispatchTypesList.map(([type, count]) => (
              <div key={type} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">{type}</span>
                <span className="text-2xl font-bold">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Dispatches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Dispatches (First 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.dispatches.slice(0, 20).map((dispatch) => (
              <div key={dispatch.id} className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center">
                      <span className="font-semibold">{dispatch.dispatchType}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {new Date(dispatch.dispatchDate).toLocaleDateString()}
                      </span>
                    </div>
                    {dispatch.wineBatch && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Batch: {dispatch.wineBatch.name} ({dispatch.wineBatch.vintage})
                      </p>
                    )}
                    {dispatch.product && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Product: {dispatch.product.name} {dispatch.product.code ? `(${dispatch.product.code})` : ''}
                      </p>
                    )}
                    {dispatch.volume && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Volume: {dispatch.volume.value} {dispatch.volume.unit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium mb-2">View raw data sample</summary>
            <pre className="bg-background p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(data.dispatches[0], null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}