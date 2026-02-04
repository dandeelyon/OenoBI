import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Wine, Package, DollarSign, Grape } from "lucide-react";

interface InventorySummary {
  totalProducts: number;
  totalBottles: number;
  totalTons: number;
  totalValue: number;
  averageBottlePrice: number;
}

interface VarietalBreakdown {
  varietal: string;
  bottles: number;
  tons: number;
  value: number;
}

interface InventoryMetricsProps {
  currentRole: string;
}

export function InventoryMetrics({ currentRole }: InventoryMetricsProps) {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [varietalBreakdown, setVarietalBreakdown] = useState<VarietalBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentRole !== 'sales') return;

    async function fetchInventoryData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/backend-api/commerce7/curated-products`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch inventory data');
        }

        const data = await response.json();
        setSummary(data.summary);
        setVarietalBreakdown(data.varietalBreakdown);
      } catch (err) {
        console.error('Error fetching inventory metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchInventoryData();
  }, [currentRole]);

  if (currentRole !== 'sales') return null;
  if (loading) return <div className="text-muted-foreground">Loading inventory data...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBottles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{summary.totalProducts} SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grape Tons Equivalent</CardTitle>
            <Grape className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTons.toFixed(1)} tons</div>
            <p className="text-xs text-muted-foreground">Based on 50 cases/ton</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(summary.totalValue / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">At current prices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Bottle Price</CardTitle>
            <Wine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(summary.averageBottlePrice).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across all varietals</p>
          </CardContent>
        </Card>
      </div>

      {/* Varietal Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory by Varietal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {varietalBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="font-medium">{item.varietal}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.bottles.toLocaleString()} bottles • {item.tons.toFixed(2)} tons
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${(item.value / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-sm text-muted-foreground">
                    {((item.value / summary.totalValue) * 100).toFixed(1)}% of value
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
