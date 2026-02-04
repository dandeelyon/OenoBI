import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { useVintraceBatches } from "../context/VintraceBatchProvider";

interface WineBatch {
  id: number;
  batchCode: string;
  batchNumber: string | null;
  description: string;
  productionYear: number;
  owner: {
    id: number;
    name: string;
    extId: string | null;
  };
  designatedVariety: {
    id: number;
    name: string;
  } | null;
  designatedRegion: {
    id: number;
    name: string;
  } | null;
  vessels: Array<{
    id: number;
    name: string;
    type: string;
    amount: {
      value: number;
      unit: string;
    };
  }>;
  allocations: any[];
  inactive: boolean;
  currentVolume: number;
  volumeUnit: string;
  totalCost?: {
    total: number;
    fruit: number;
    overhead: number;
    storage: number;
    additive: number;
    bulk: number;
    packaging: number;
    operation: number;
    freight: number;
    other: number;
  };
}

export function WineBatchesView() {
  const { batches2024, batches2025, loading, error } = useVintraceBatches();

  const renderBatchCard = (batch: WineBatch) => (
    <div 
      key={batch.id} 
      className="p-3 bg-muted rounded-lg space-y-2 hover:bg-muted/80 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-sm">{batch.batchCode}</p>
          <p className="text-xs text-muted-foreground">{batch.description}</p>
          
          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
            {batch.designatedVariety && (
              <p><span className="font-medium">Variety:</span> {batch.designatedVariety.name}</p>
            )}
            {batch.designatedRegion && (
              <p><span className="font-medium">Region:</span> {batch.designatedRegion.name}</p>
            )}
            <p><span className="font-medium">Volume:</span> {batch.currentVolume?.toFixed(1)} {batch.volumeUnit}</p>
            {batch.totalCost && (
              <>
                <p><span className="font-medium">Total Cost:</span> ${batch.totalCost.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><span className="font-medium">Cost/Gallon:</span> ${(batch.totalCost.total / batch.currentVolume).toFixed(2)}</p>
                {batch.totalCost.fruit > 0 && (
                  <p className="text-[10px] pl-2">
                    Fruit: ${batch.totalCost.fruit.toFixed(2)} | 
                    Additive: ${batch.totalCost.additive.toFixed(2)} | 
                    Storage: ${batch.totalCost.storage.toFixed(2)}
                  </p>
                )}
              </>
            )}
            {batch.vessels && batch.vessels.length > 0 && (
              <p>
                <span className="font-medium">Vessels ({batch.vessels.length}):</span> {batch.vessels.map(v => v.name).join(', ')}
              </p>
            )}
          </div>
        </div>
        {batch.inactive && (
          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
            Inactive
          </span>
        )}
      </div>
    </div>
  );

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
            <p className="font-semibold">Error loading wine batches:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 2024 Batches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>2024 Vintages</span>
            <span className="text-sm font-normal text-muted-foreground">
              {loading ? '...' : `${batches2024.length} batches`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {batches2024.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No 2024 batches found
                </p>
              ) : (
                batches2024.map(renderBatchCard)
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2025 Batches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>2025 Vintages</span>
            <span className="text-sm font-normal text-muted-foreground">
              {loading ? '...' : `${batches2025.length} batches`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {batches2025.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No 2025 batches found
                </p>
              ) : (
                batches2025.map(renderBatchCard)
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}