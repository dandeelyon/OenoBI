import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useState } from "react";

const VINTRACE_SEARCH_TYPES = [
  "batch", "varietal", "vintage", "owner", "tank", "vessel",
  "grading", "program", "productState", "region", "block",
  "grower", "productCategory", "product", "tank", "vessel",
  "containerEquipment", "barrel", "bin"
];

export function VintraceExplorer() {
  const [selectedType, setSelectedType] = useState<string>("batch");
  const [startsWith, setStartsWith] = useState<string>("BBV");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const params = new URLSearchParams({
        type: selectedType,
      });

      if (startsWith) {
        params.append("startsWith", startsWith);
      }

      const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/search?${params}`;
      
      console.log("[Vintrace Explorer] Fetching:", url);
      console.log("[Vintrace Explorer] Expected Vintrace URL: https://us30.vintrace.net/bla/v6/search/list");

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log("[Vintrace Explorer] Success! Count:", data.count);
      setResults(data);
    } catch (err) {
      console.error("[Vintrace Explorer] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGetBatches = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/batches`;
      
      console.log("[Vintrace Explorer] Fetching batches:", url);

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data);
    } catch (err) {
      console.error("[Vintrace Explorer] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGetWineBatches = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/wine-batches?bbvOnly=true`;
      
      console.log("[Vintrace Explorer] Fetching wine batches:", url);

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data);
    } catch (err) {
      console.error("[Vintrace Explorer] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGetVesselDetails = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/backend-api/vintrace/vessel-details`;
      
      console.log("[Vintrace Explorer] Fetching vessel details:", url);

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data);
    } catch (err) {
      console.error("[Vintrace Explorer] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-blue-900">Vintrace API Configuration</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 font-mono">
              <div>
                <span className="text-blue-600">v6 Base:</span> https://us30.vintrace.net/bla/v6/
              </div>
              <div>
                <span className="text-blue-600">v7 Base:</span> https://us30.vintrace.net/bla/v7/
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              All searches use the v6 endpoint: <code className="bg-blue-100 px-1 rounded">/search/list</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vintrace API Explorer</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test Vintrace API endpoints and explore batch data
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Controls */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search Type</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  {VINTRACE_SEARCH_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Starts With</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  placeholder="BBV"
                  value={startsWith}
                  onChange={(e) => setStartsWith(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={loading}
              >
                {loading ? "Loading..." : "Search"}
              </Button>
              <Button 
                onClick={handleGetBatches} 
                disabled={loading}
                variant="outline"
              >
                Get BBV Batches (v6)
              </Button>
              <Button 
                onClick={handleGetWineBatches} 
                disabled={loading}
                variant="outline"
              >
                Get Wine Batches (v7)
              </Button>
              <Button 
                onClick={handleGetVesselDetails} 
                disabled={loading}
                variant="outline"
              >
                Get Vessel Details (v7)
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
              <p className="font-semibold">Error:</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Results Display */}
          {results && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Results: <span className="text-primary">{results.count || 0}</span>
                  {results.productionYears && (
                    <span className="ml-2 text-muted-foreground">
                      ({results.productionYears.join(', ')})
                    </span>
                  )}
                </p>
                {results.query && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {JSON.stringify(results.query)}
                  </p>
                )}
              </div>

              {/* Display wine batches from v7 endpoint */}
              {results.batches && results.batches[0]?.owner && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Wine Batches (v7):</p>
                  {results.batches.slice(0, 20).map((batch: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-muted rounded-lg space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold">{batch.batchCode}</p>
                          <p className="text-sm text-muted-foreground">{batch.description}</p>
                          
                          <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-1">
                            <p><span className="font-medium">Owner:</span> {batch.owner?.name}</p>
                            <p><span className="font-medium">Year:</span> {batch.productionYear}</p>
                            <p><span className="font-medium">Variety:</span> {batch.designatedVariety?.name || 'N/A'}</p>
                            <p><span className="font-medium">Region:</span> {batch.designatedRegion?.name || 'N/A'}</p>
                            <p><span className="font-medium">Volume:</span> {batch.currentVolume?.toFixed(1) || '0'} {batch.volumeUnit}</p>
                            <p><span className="font-medium">Total Cost:</span> ${batch.totalCost?.total?.toFixed(2) || '0.00'}</p>
                            <p><span className="font-medium">Cost/Gallon:</span> ${batch.currentVolume > 0 ? (batch.totalCost?.total / batch.currentVolume).toFixed(2) : '0.00'}</p>
                            {batch.totalCost && batch.totalCost.fruit > 0 && (
                              <p className="col-span-2 text-[10px] pl-2">
                                <span className="font-medium">Breakdown:</span> Fruit: ${batch.totalCost.fruit.toFixed(2)} | 
                                Additive: ${batch.totalCost.additive.toFixed(2)} | 
                                Storage: ${batch.totalCost.storage.toFixed(2)} | 
                                Other: ${(batch.totalCost.overhead + batch.totalCost.bulk + batch.totalCost.packaging + batch.totalCost.operation + batch.totalCost.freight + batch.totalCost.other).toFixed(2)}
                              </p>
                            )}
                            {batch.vessels && batch.vessels.length > 0 && (
                              <p className="col-span-2">
                                <span className="font-medium">Vessels ({batch.vessels.length}):</span> {batch.vessels.map((v: any) => v.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <span className={`text-xs px-2 py-1 rounded ${
                            batch.owner?.name === 'Blackbird Vineyards' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {batch.owner?.name === 'Blackbird Vineyards' ? 'BBV' : batch.owner?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {results.batches.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing first 20 of {results.batches.length} batches
                    </p>
                  )}
                </div>
              )}

              {/* Display batches with parsed codes (v6 style) */}
              {results.batches && !results.batches[0]?.owner && (
                <div className="space-y-2">
                  {results.batches.slice(0, 10).map((batch: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-muted rounded-lg space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{batch.code || batch.name}</p>
                          {batch.parsed && batch.parsed.isValid && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                              <p>Vintage: {batch.parsed.vintageYear}</p>
                              <p>Variety: {batch.parsed.variety}</p>
                              <p>Vineyard: {batch.parsed.vineyard}</p>
                              <p>Sequence: {batch.parsed.sequence}</p>
                            </div>
                          )}
                        </div>
                        {batch.parsed && !batch.parsed.isValid && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Invalid Format
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {results.batches.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing first 10 of {results.batches.length} batches
                    </p>
                  )}
                </div>
              )}

              {/* Raw JSON Results */}
              <details className="cursor-pointer">
                <summary className="text-sm text-muted-foreground hover:text-foreground">
                  View Raw JSON
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}