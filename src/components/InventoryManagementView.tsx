import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { useVintraceBatches } from "../context/VintraceBatchProvider";
import { useMemo } from "react";

export function InventoryManagementView() {
  const { allBatches, loading, error } = useVintraceBatches();

  // Calculate inventory metrics from batch data
  const inventoryStats = useMemo(() => {
    if (!allBatches || allBatches.length === 0) return null;

    const totalVolume = allBatches.reduce((sum, batch) => sum + (batch.currentVolume || 0), 0);
    const totalCost = allBatches.reduce((sum, batch) => sum + (batch.totalCost?.total || 0), 0);
    const avgCostPerGallon = totalVolume > 0 ? totalCost / totalVolume : 0;

    // Group by variety
    const byVariety = allBatches.reduce((acc, batch) => {
      const variety = batch.designatedVariety?.name || 'Unknown';
      if (!acc[variety]) {
        acc[variety] = { volume: 0, cost: 0, batches: 0 };
      }
      acc[variety].volume += batch.currentVolume || 0;
      acc[variety].cost += batch.totalCost?.total || 0;
      acc[variety].batches += 1;
      return acc;
    }, {} as Record<string, { volume: number; cost: number; batches: number }>);

    // Group by vintage
    const byVintage = allBatches.reduce((acc, batch) => {
      const vintage = batch.productionYear || 0;
      if (!acc[vintage]) {
        acc[vintage] = { volume: 0, cost: 0, batches: 0 };
      }
      acc[vintage].volume += batch.currentVolume || 0;
      acc[vintage].cost += batch.totalCost?.total || 0;
      acc[vintage].batches += 1;
      return acc;
    }, {} as Record<number, { volume: number; cost: number; batches: number }>);

    return {
      totalVolume,
      totalCost,
      avgCostPerGallon,
      batchCount: allBatches.length,
      byVariety,
      byVintage,
    };
  }, [allBatches]);

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
            <p className="font-semibold">Error loading inventory data:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inventoryStats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-8">
            No inventory data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Batches</p>
                <p className="text-2xl font-bold">{inventoryStats.batchCount}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold">{inventoryStats.totalVolume.toFixed(0)} gal</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${inventoryStats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Avg Cost/Gallon</p>
                <p className="text-2xl font-bold">${inventoryStats.avgCostPerGallon.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Variety */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory by Variety</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {Object.entries(inventoryStats.byVariety)
              .sort((a, b) => b[1].volume - a[1].volume)
              .map(([variety, stats]) => (
                <div key={variety} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{variety}</p>
                      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-2">
                        <p><span className="font-medium">Batches:</span> {stats.batches}</p>
                        <p><span className="font-medium">Volume:</span> {stats.volume.toFixed(0)} gal</p>
                        <p><span className="font-medium">Total Cost:</span> ${stats.cost.toFixed(0)}</p>
                        <p><span className="font-medium">Cost/Gal:</span> ${(stats.cost / stats.volume).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* By Vintage */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory by Vintage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(inventoryStats.byVintage)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([vintage, stats]) => (
                <div key={vintage} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{vintage} Vintage</p>
                      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-2">
                        <p><span className="font-medium">Batches:</span> {stats.batches}</p>
                        <p><span className="font-medium">Volume:</span> {stats.volume.toFixed(0)} gal</p>
                        <p><span className="font-medium">Total Cost:</span> ${stats.cost.toFixed(0)}</p>
                        <p><span className="font-medium">Cost/Gal:</span> ${(stats.cost / stats.volume).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch List */}
      <Card>
        <CardHeader>
          <CardTitle>All Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {allBatches
              .sort((a, b) => b.productionYear - a.productionYear || a.batchCode.localeCompare(b.batchCode))
              .map((batch) => (
                <div key={batch.id} className="p-2 bg-muted rounded text-xs hover:bg-muted/80 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-semibold">{batch.batchCode}</p>
                      <p className="text-muted-foreground text-[10px]">
                        {batch.designatedVariety?.name} • {batch.currentVolume.toFixed(0)} gal • ${batch.totalCost?.total.toFixed(0)}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      {batch.productionYear}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
