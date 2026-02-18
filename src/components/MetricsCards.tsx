import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Truck, Clock, Target, BarChart3 } from "lucide-react";
import { UserRole } from "../App";
import { useDashExecContext } from "../context/DashExecProvider";
import { Skeleton } from "./ui/skeleton";

interface MetricData {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ReactNode;
  description: string;
}

interface MetricsCardsProps {
  timePeriod: string;
  currentRole: UserRole;
}

export function MetricsCards({ timePeriod, currentRole }: MetricsCardsProps) {
  const { data: dashData, loading, error } = useDashExecContext();

  // A2) GUARD: Belt + Suspenders - assume provider can be null/empty
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !dashData) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Unable to load metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error || "Dashboard data is unavailable. Please try refreshing the page."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRoleSpecificMetrics = (role: UserRole, period: string): MetricData[] => {
    // If we're in Sales role and have Commerce 7 data, use real data (filtered client-side)
    if (role === 'sales' && dashData && !loading && !error) {
      const { overview } = dashData;
      
      // CLIENT-SIDE FILTERING: Choose which time window based on timePeriod
      // No network call - just pick the right field from cached payload
      const revenueByPeriod: Record<string, number | undefined> = {
        today: overview.revenue.today,
        week: overview.revenue.week,
        month: overview.revenue.month,
        quarter: overview.revenue.quarter,
        year: overview.revenue.year,
      };
      const ordersByPeriod: Record<string, number | undefined> = {
        today: overview.orders.today,
        week: overview.orders.week,
        month: overview.orders.month,
        quarter: overview.orders.quarter,
        year: overview.orders.year,
      };
      const revenue = revenueByPeriod[period] ?? overview.revenue.last30Days;
      const orders = ordersByPeriod[period] ?? overview.orders.last30Days;
      const avgOrderValue = orders > 0 ? revenue / orders : 0;
      
      return [
        { 
          title: "Sales Revenue", 
          value: `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
          change: 18.5, // TODO: Calculate from historical data
          icon: <DollarSign className="h-4 w-4" />,
          changeType: 'increase' as const,
          description: `vs previous ${period}`
        },
        { 
          title: "Total Orders", 
          value: orders.toString(), 
          change: 24.1,
          icon: <ShoppingCart className="h-4 w-4" />,
          changeType: 'increase' as const,
          description: `vs previous ${period}`
        },
        { 
          title: "Inventory", 
          value: overview.inventory.totalBottles.toLocaleString(), 
          change: 5.3,
          icon: <Package className="h-4 w-4" />,
          changeType: 'decrease' as const,
          description: `bottles available`
        },
        { 
          title: "Avg Order Value", 
          value: `$${avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
          change: 12.3,
          icon: <Target className="h-4 w-4" />,
          changeType: 'increase' as const,
          description: `vs previous ${period}`
        }
      ];
    }

    const baseData = {
      today: {
        accounting: [
          { title: "Total Revenue", value: "$24,750", change: 5.2, icon: <DollarSign className="h-4 w-4" /> },
          { title: "Operating Margin", value: "23.8%", change: 2.1, icon: <BarChart3 className="h-4 w-4" /> },
          { title: "Cash Flow", value: "$8,420", change: 12.3, icon: <TrendingUp className="h-4 w-4" /> },
          { title: "EBITDA", value: "$12,300", change: 8.7, icon: <Target className="h-4 w-4" /> }
        ],
        enterprise: [
          { title: "Inventory Turnover", value: "6.2x", change: 8.4, icon: <Package className="h-4 w-4" /> },
          { title: "On-Time Delivery", value: "94.2%", change: 3.1, icon: <Truck className="h-4 w-4" /> },
          { title: "Production Efficiency", value: "87.5%", change: 2.8, icon: <BarChart3 className="h-4 w-4" /> },
          { title: "Avg Processing Time", value: "2.3h", change: -5.2, icon: <Clock className="h-4 w-4" /> }
        ],
        sales: [
          { title: "Sales Revenue", value: "$24,750", change: 5.2, icon: <DollarSign className="h-4 w-4" /> },
          { title: "Conversion Rate", value: "3.8%", change: 12.1, icon: <Target className="h-4 w-4" /> },
          { title: "New Customers", value: "47", change: 18.3, icon: <Users className="h-4 w-4" /> },
          { title: "Pipeline Value", value: "$187k", change: 15.7, icon: <TrendingUp className="h-4 w-4" /> }
        ]
      },
      month: {
        accounting: [
          { title: "Total Revenue", value: "$742,850", change: 18.5, icon: <DollarSign className="h-4 w-4" /> },
          { title: "Operating Margin", value: "24.3%", change: 4.2, icon: <BarChart3 className="h-4 w-4" /> },
          { title: "Cash Flow", value: "$180,420", change: 22.8, icon: <TrendingUp className="h-4 w-4" /> },
          { title: "EBITDA", value: "$298,750", change: 16.9, icon: <Target className="h-4 w-4" /> }
        ],
        enterprise: [
          { title: "Inventory Turnover", value: "5.8x", change: 12.1, icon: <Package className="h-4 w-4" /> },
          { title: "On-Time Delivery", value: "96.1%", change: 5.2, icon: <Truck className="h-4 w-4" /> },
          { title: "Production Efficiency", value: "89.2%", change: 6.8, icon: <BarChart3 className="h-4 w-4" /> },
          { title: "Avg Processing Time", value: "2.1h", change: -8.3, icon: <Clock className="h-4 w-4" /> }
        ],
        sales: [
          { title: "Sales Revenue", value: "$742,850", change: 18.5, icon: <DollarSign className="h-4 w-4" /> },
          { title: "Conversion Rate", value: "4.2%", change: 24.1, icon: <Target className="h-4 w-4" /> },
          { title: "New Customers", value: "1,284", change: 31.2, icon: <Users className="h-4 w-4" /> },
          { title: "Pipeline Value", value: "$2.1M", change: 28.4, icon: <TrendingUp className="h-4 w-4" /> }
        ]
      }
    };

    const periodData = baseData[period as keyof typeof baseData] || baseData.month;
    const roleData = periodData[role] || periodData.accounting;

    return roleData.map(metric => ({
      ...metric,
      changeType: metric.change > 0 ? 'increase' as const : 'decrease' as const,
      description: `vs previous ${period}`
    }));
  };

  const metrics = getRoleSpecificMetrics(currentRole, timePeriod);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <div className="text-muted-foreground">
              {metric.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant={metric.changeType === 'increase' ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {metric.changeType === 'increase' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(metric.change)}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {metric.description}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
