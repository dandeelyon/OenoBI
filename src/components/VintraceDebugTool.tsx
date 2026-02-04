import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useState } from "react";

export function VintraceDebugTool() {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("/stock/dispatches");
  const [params, setParams] = useState("");
  const [apiVersion, setApiVersion] = useState("v7");

  const testEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Build URL with params
      const baseUrl = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/debug`;
      const queryParams = params ? `?endpoint=${encodeURIComponent(endpoint)}&params=${encodeURIComponent(params)}&apiVersion=${apiVersion}` : `?endpoint=${encodeURIComponent(endpoint)}&apiVersion=${apiVersion}`;
      const url = baseUrl + queryParams;

      console.log('[Vintrace Debug] Testing endpoint:', endpoint);
      console.log('[Vintrace Debug] With params:', params);
      console.log('[Vintrace Debug] Full URL:', url);

      const result = await fetch(url);

      const data = await result.json();

      console.log('[Vintrace Debug] Frontend received response:', data);
      console.log('[Vintrace Debug] Response has debug?', !!data?.debug);
      console.log('[Vintrace Debug] Response endpoint:', data?.endpoint);
      console.log('[Vintrace Debug] Response url:', data?.url);

      if (!result.ok) {
        setError(`HTTP ${result.status}: ${JSON.stringify(data, null, 2)}`);
      } else {
        setResponse(data);
      }

      console.log('[Vintrace Debug] Response:', data);
      console.log('[Vintrace Debug] Response type:', typeof data);
      console.log('[Vintrace Debug] Response keys:', Object.keys(data || {}));
      console.log('[Vintrace Debug] Response.raw:', data?.raw);
      console.log('[Vintrace Debug] Response.raw type:', typeof data?.raw);
    } catch (err) {
      console.error("[Vintrace Debug] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vintrace API Debug Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Endpoint Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Endpoint Path (e.g., /stock/dispatches)
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full p-2 border rounded text-sm font-mono"
            placeholder="/stock/dispatches"
          />
        </div>

        {/* Params Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Query Parameters (JSON format, optional)
          </label>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            className="w-full p-2 border rounded text-sm font-mono"
            rows={3}
            placeholder='{"offset": 0, "limit": 10}'
          />
        </div>

        {/* API Version Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            API Version (default: v7)
          </label>
          <input
            type="text"
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            className="w-full p-2 border rounded text-sm font-mono"
            placeholder="v7"
          />
        </div>

        {/* Test Button */}
        <Button 
          onClick={testEndpoint} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Testing..." : "Test Endpoint"}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-sm font-semibold text-red-800 mb-2">Error:</p>
            <pre className="text-xs text-red-700 overflow-auto max-h-64 whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-2">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-semibold text-green-800 mb-2">✓ Success!</p>
              <p className="text-xs text-green-700">
                Response received from Vintrace API
              </p>
            </div>

            {/* Response Stats */}
            {response.raw && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-bold">{response.status || 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-bold">{Array.isArray(response.raw) ? 'Array' : typeof response.raw}</p>
                </div>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm font-bold">
                    {Array.isArray(response.raw) ? response.raw.length : 
                     response.raw?.results?.length || response.raw?.totalResults || 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Full Response Debug */}
            <details className="border rounded" open>
              <summary className="p-3 bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100 font-medium text-sm">
                📦 View Full Response Object (Debug)
              </summary>
              <div className="p-4 bg-background">
                <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </details>

            {/* Raw JSON */}
            <details className="border rounded">
              <summary className="p-3 bg-muted cursor-pointer hover:bg-muted/80 font-medium text-sm">
                View Raw JSON Response
              </summary>
              <div className="p-4 bg-background">
                <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                  {JSON.stringify(response.raw, null, 2)}
                </pre>
              </div>
            </details>

            {/* Sample Record */}
            {response.raw?.results?.[0] && (
              <details className="border rounded">
                <summary className="p-3 bg-muted cursor-pointer hover:bg-muted/80 font-medium text-sm">
                  View First Record
                </summary>
                <div className="p-4 bg-background">
                  <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(response.raw.results[0], null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Quick Test Examples */}
        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium mb-2">Quick Tests - Looking for Bottled/Dispatched Wine:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/operation/bottling-runs");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-amber-50 border-amber-200"
            >
              🍾 Bottling Runs (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/operation/packaging-runs");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-amber-50 border-amber-200"
            >
              📦 Packaging Runs (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/report/stock-report");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-green-50 border-green-200"
            >
              📊 Stock Report (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/report/packaging-report");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-green-50 border-green-200"
            >
              📋 Packaging Report (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/stock/stock-summary");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-blue-50 border-blue-200"
            >
              📈 Stock Summary (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/stock/locations");
                setParams('{"offset": 0, "limit": 50}');
                setApiVersion("v7");
              }}
              className="col-span-2 bg-blue-50 border-blue-200"
            >
              📍 Stock Locations (v7)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/report/vessel-details-report");
                setParams('{"offset": 0, "limit": 5, "owner": "3"}');
                setApiVersion("v7");
              }}
            >
              ✅ Vessel Details (Working)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEndpoint("/operation/wine-batches");
                setParams('{"offset": 0, "limit": 5, "owner": "3"}');
                setApiVersion("v7");
              }}
            >
              ✅ Wine Batches (Working)
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <p className="font-medium mb-1">📝 How to use:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Enter a Vintrace v7 API endpoint path</li>
            <li>Optionally add query parameters as JSON</li>
            <li>Click "Test Endpoint" to see the raw response</li>
            <li>Use Quick Tests for common endpoints</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}