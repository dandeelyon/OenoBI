import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart, ComposedChart, Tooltip, Legend } from "recharts";
import { UserRole } from "../App";
import { useDashExecContext } from "../context/DashExecProvider";
import { Skeleton } from "./ui/skeleton";
import { VintraceExplorer } from "./VintraceExplorer";
import { WineBatchesView } from "./WineBatchesView";
import { InventoryManagementView } from "./InventoryManagementView";
import { DeliveryPerformanceView } from "./DeliveryPerformanceView";
import { BottledWinesView } from "./BottledWinesView";
import { VintraceBatchProvider } from "../context/VintraceBatchProvider";

interface ChartsSectionProps {
  timePeriod: string;
  currentRole: UserRole;
}

export function ChartsSection({ timePeriod, currentRole }: ChartsSectionProps) {
  const { data: dashData, loading, error } = useDashExecContext();

  // A2) GUARD: Belt + Suspenders - assume provider can be null/empty
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

  if (error || !dashData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">
            <p className="font-semibold">Error loading dashboard data:</p>
            <p className="mt-2 font-mono text-sm">{error || 'No data available'}</p>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View error details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-96">
                {JSON.stringify({ error, dashData }, null, 2)}
              </pre>
            </details>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Role-specific chart configurations
  const getRoleChartConfig = (role: UserRole) => {
    switch (role) {
      case 'accounting':
        return {
          tabs: [
            { key: 'financial', label: 'Financial Performance' },
            { key: 'profitability', label: 'Profitability' },
            { key: 'cashflow', label: 'Cash Flow' }
          ]
        };
      case 'enterprise':
        return {
          tabs: [
            { key: 'efficiency', label: 'Wine Batches' },
            { key: 'inventory', label: 'Inventory Management' },
            { key: 'delivery', label: 'Bottled Wines' },
            { key: 'vintrace', label: 'Vintrace Explorer' }
          ]
        };
      case 'sales':
        return {
          tabs: [
            { key: 'sales', label: 'DTC Sales' },
            { key: 'pipeline', label: 'Wholesale Sales' },
            { key: 'customers', label: 'Customer Analytics' }
          ]
        };
      default:
        return {
          tabs: [
            { key: 'sales', label: 'Sales & Revenue' },
            { key: 'inventory', label: 'Inventory' },
            { key: 'cashflow', label: 'Cash Flow' }
          ]
        };
    }
  };

  // CFO Data
  const financialData = [
    { month: 'Jan', revenue: 650000, expenses: 480000, profit: 170000 },
    { month: 'Feb', revenue: 720000, expenses: 520000, profit: 200000 },
    { month: 'Mar', revenue: 680000, expenses: 495000, profit: 185000 },
    { month: 'Apr', revenue: 780000, expenses: 550000, profit: 230000 },
    { month: 'May', revenue: 850000, expenses: 580000, profit: 270000 },
    { month: 'Jun', revenue: 920000, expenses: 620000, profit: 300000 },
  ];

  const profitabilityData = [
    { quarter: 'Q1', grossMargin: 68, operatingMargin: 24, netMargin: 18 },
    { quarter: 'Q2', grossMargin: 71, operatingMargin: 26, netMargin: 20 },
    { quarter: 'Q3', grossMargin: 69, operatingMargin: 25, netMargin: 19 },
    { quarter: 'Q4', grossMargin: 73, operatingMargin: 28, netMargin: 22 },
  ];

  // Operations Data
  const efficiencyData = [
    { month: 'Jan', productivity: 85, utilization: 78, quality: 94 },
    { month: 'Feb', productivity: 88, utilization: 82, quality: 96 },
    { month: 'Mar', productivity: 86, utilization: 80, quality: 95 },
    { month: 'Apr', productivity: 90, utilization: 85, quality: 97 },
    { month: 'May', productivity: 92, utilization: 87, quality: 98 },
    { month: 'Jun', productivity: 94, utilization: 89, quality: 97 },
  ];

  const inventoryData = [
    { category: 'Electronics', stock: 450, turnover: 6.2, value: 450000 },
    { category: 'Furniture', stock: 280, turnover: 4.8, value: 280000 },
    { category: 'Clothing', stock: 220, turnover: 8.1, value: 220000 },
    { category: 'Books', stock: 180, turnover: 12.3, value: 180000 },
    { category: 'Sports', stock: 70, turnover: 9.5, value: 70000 },
  ];

  const deliveryData = [
    { week: 'W1', onTime: 94, delayed: 4, early: 2 },
    { week: 'W2', onTime: 96, delayed: 3, early: 1 },
    { week: 'W3', onTime: 92, delayed: 6, early: 2 },
    { week: 'W4', onTime: 97, delayed: 2, early: 1 },
  ];

  // Sales Data
  const salesData = [
    { month: 'Jan', revenue: 650000, leads: 420, conversions: 58, pipeline: 1200000 },
    { month: 'Feb', revenue: 720000, leads: 480, conversions: 67, pipeline: 1350000 },
    { month: 'Mar', revenue: 680000, leads: 445, conversions: 62, pipeline: 1280000 },
    { month: 'Apr', revenue: 780000, leads: 520, conversions: 74, pipeline: 1450000 },
    { month: 'May', revenue: 850000, leads: 580, conversions: 82, pipeline: 1620000 },
    { month: 'Jun', revenue: 920000, leads: 630, conversions: 89, pipeline: 1780000 },
  ];

  // Wholesale Data - State by State Analysis
  const wholesaleStateData = [
    { 
      state: 'California', 
      revenue: 1850000, 
      bottles: 18500, 
      marketPotential: 5000000, 
      marketShare: 12.5, 
      yoyGrowth: 18, 
      distributors: 8,
      accounts: 145,
      region: 'West'
    },
    { 
      state: 'New York', 
      revenue: 1420000, 
      bottles: 14200, 
      marketPotential: 4200000, 
      marketShare: 10.8, 
      yoyGrowth: 22, 
      distributors: 6,
      accounts: 118,
      region: 'Northeast'
    },
    { 
      state: 'Texas', 
      revenue: 980000, 
      bottles: 9800, 
      marketPotential: 3500000, 
      marketShare: 8.2, 
      yoyGrowth: 15, 
      distributors: 5,
      accounts: 92,
      region: 'South'
    },
    { 
      state: 'Florida', 
      revenue: 875000, 
      bottles: 8750, 
      marketPotential: 3200000, 
      marketShare: 9.5, 
      yoyGrowth: 28, 
      distributors: 4,
      accounts: 87,
      region: 'South'
    },
    { 
      state: 'Illinois', 
      revenue: 720000, 
      bottles: 7200, 
      marketPotential: 2100000, 
      marketShare: 11.2, 
      yoyGrowth: 12, 
      distributors: 3,
      accounts: 68,
      region: 'Midwest'
    },
    { 
      state: 'Massachusetts', 
      revenue: 650000, 
      bottles: 6500, 
      marketPotential: 1800000, 
      marketShare: 13.8, 
      yoyGrowth: 25, 
      distributors: 3,
      accounts: 54,
      region: 'Northeast'
    },
    { 
      state: 'Washington', 
      revenue: 580000, 
      bottles: 5800, 
      marketPotential: 1600000, 
      marketShare: 10.5, 
      yoyGrowth: 19, 
      distributors: 3,
      accounts: 48,
      region: 'West'
    },
    { 
      state: 'Colorado', 
      revenue: 485000, 
      bottles: 4850, 
      marketPotential: 1400000, 
      marketShare: 9.8, 
      yoyGrowth: 31, 
      distributors: 2,
      accounts: 41,
      region: 'West'
    },
    { 
      state: 'New Jersey', 
      revenue: 420000, 
      bottles: 4200, 
      marketPotential: 1900000, 
      marketShare: 6.2, 
      yoyGrowth: 8, 
      distributors: 2,
      accounts: 38,
      region: 'Northeast'
    },
    { 
      state: 'Georgia', 
      revenue: 380000, 
      bottles: 3800, 
      marketPotential: 1500000, 
      marketShare: 7.8, 
      yoyGrowth: 14, 
      distributors: 2,
      accounts: 32,
      region: 'South'
    }
  ];

  // Regional Performance Summary
  const regionalData = [
    { region: 'West', revenue: 2915000, bottles: 29150, states: 3, marketShare: 11.2, yoyGrowth: 19 },
    { region: 'Northeast', revenue: 2490000, bottles: 24900, states: 3, marketShare: 10.5, yoyGrowth: 18 },
    { region: 'South', revenue: 2235000, bottles: 22350, states: 3, marketShare: 8.5, yoyGrowth: 19 },
    { region: 'Midwest', revenue: 720000, bottles: 7200, states: 1, marketShare: 11.2, yoyGrowth: 12 }
  ];

  // Top Distributors
  const distributorData = [
    { name: 'Premium Wine Distributors CA', revenue: 1250000, accounts: 89, states: 2, performance: 94 },
    { name: 'Northeast Wine Group', revenue: 980000, accounts: 72, states: 3, performance: 91 },
    { name: 'Southern Wine & Spirits', revenue: 845000, accounts: 68, states: 4, performance: 88 },
    { name: 'Midwest Premium Partners', revenue: 720000, accounts: 52, states: 2, performance: 92 },
    { name: 'Pacific Coast Wines', revenue: 685000, accounts: 45, states: 2, performance: 89 }
  ];

  // Growth Opportunity States (High potential, lower current penetration)
  const opportunityStates = [
    { state: 'New Jersey', gap: 1480000, currentShare: 6.2, potential: 'High', priority: 1 },
    { state: 'Pennsylvania', gap: 1350000, currentShare: 0, potential: 'Very High', priority: 2 },
    { state: 'Virginia', gap: 980000, currentShare: 0, potential: 'High', priority: 3 },
    { state: 'Arizona', gap: 920000, currentShare: 0, potential: 'High', priority: 4 },
    { state: 'North Carolina', gap: 850000, currentShare: 0, potential: 'Medium', priority: 5 }
  ];

  const pipelineData = [
    { stage: 'Prospects', value: 2400000, deals: 145 },
    { stage: 'Qualified', value: 1800000, deals: 98 },
    { stage: 'Proposal', value: 1200000, deals: 52 },
    { stage: 'Negotiation', value: 800000, deals: 24 },
    { stage: 'Closed Won', value: 450000, deals: 12 },
  ];

  const customerData = [
    { segment: 'Enterprise', count: 145, revenue: 450000, satisfaction: 92 },
    { segment: 'Mid-Market', count: 420, revenue: 320000, satisfaction: 88 },
    { segment: 'Small Business', count: 1250, revenue: 180000, satisfaction: 85 },
    { segment: 'Startup', count: 890, revenue: 95000, satisfaction: 83 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const config = getRoleChartConfig(currentRole);

  const renderAccountingCharts = () => (
    <Tabs defaultValue="financial" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        {config.tabs.map(tab => (
          <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      
      <TabsContent value="financial">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                <Bar dataKey="expenses" fill="#82ca9d" name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#ff7300" strokeWidth={3} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="profitability">
        <Card>
          <CardHeader>
            <CardTitle>Margin Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={profitabilityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis />
                <Line type="monotone" dataKey="grossMargin" stroke="#8884d8" strokeWidth={2} name="Gross Margin %" />
                <Line type="monotone" dataKey="operatingMargin" stroke="#82ca9d" strokeWidth={2} name="Operating Margin %" />
                <Line type="monotone" dataKey="netMargin" stroke="#ffc658" strokeWidth={2} name="Net Margin %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="cashflow">
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Area type="monotone" dataKey="profit" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

  const renderEnterpriseCharts = () => (
    <VintraceBatchProvider>
      <Tabs defaultValue="efficiency" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {config.tabs.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="efficiency">
          <WineBatchesView />
        </TabsContent>
        
        <TabsContent value="inventory">
          <InventoryManagementView />
        </TabsContent>
        
        <TabsContent value="delivery">
          <BottledWinesView />
        </TabsContent>

        <TabsContent value="vintrace">
          <Card>
            <CardHeader>
              <CardTitle>Vintrace Explorer</CardTitle>
            </CardHeader>
            <CardContent>
              <VintraceExplorer />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </VintraceBatchProvider>
  );

  const renderSalesCharts = () => {
    // DEFENSIVE: Canonical mappings to prevent crashes from undefined variables
    const salesPerformanceData = Array.isArray(dashData?.monthlyTrend) ? dashData.monthlyTrend : [];
    const topSkuData = Array.isArray(dashData?.topMovers) ? dashData.topMovers : [];
    
    // Use Commerce 7 data if available, otherwise use fallback data
    const actualSalesData = (dashData && Array.isArray(dashData.monthlyTrend) && dashData.monthlyTrend.length > 0) 
      ? dashData.monthlyTrend // Use bottles directly from server
      : salesData;
    
    const isCommerceData = dashData && Array.isArray(dashData.monthlyTrend) && dashData.monthlyTrend.length > 0;

    // Get top SKU from last 30 days
    const topSku = dashData && dashData.topMovers && dashData.topMovers.length > 0 
      ? dashData.topMovers[0] 
      : null;

    // Format currency for Y-axis
    const formatCurrency = (value: number) => {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value}`;
    };

    // Format number for Y-axis
    const formatNumber = (value: number) => {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toString();
    };

    return (
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {config.tabs.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="sales">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>DTC Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Order Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top SKU</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    DTC Sales
                    {isCommerceData && <span className="text-xs text-muted-foreground ml-2">(Commerce 7 Data)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Debug info for sanity check */}
                  {isCommerceData && actualSalesData.length > 0 && (() => {
                    // Log revenue data for verification
                    console.log('[SANITY CHECK] Sales Performance Data:', actualSalesData);
                    const novemberData = actualSalesData.find((d: any) => d.month?.includes('Nov'));
                    if (novemberData) {
                      console.log('[SANITY CHECK] November 2025 Revenue:', novemberData.revenue);
                    }
                    const totalRevenue = actualSalesData.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0);
                    console.log('[SANITY CHECK] Total Revenue (all months):', totalRevenue);
                    return null;
                  })()}
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={actualSalesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis 
                        label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
                        tickFormatter={formatCurrency}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          // Show exact values for verification
                          return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                        }}
                        labelFormatter={(label: string) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                      {!isCommerceData && <Line type="monotone" dataKey="conversions" stroke="#ff7300" strokeWidth={2} name="Conversions" />}
                    </ComposedChart>
                  </ResponsiveContainer>
                  {/* Show data table for verification */}
                  {isCommerceData && actualSalesData.length > 0 && (
                    <div className="mt-4 text-xs">
                      <details className="cursor-pointer">
                        <summary className="text-muted-foreground hover:text-foreground">
                          View raw data (for sanity check)
                        </summary>
                        <div className="mt-2 space-y-1 font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto">
                          {/* Cache Status Info */}
                          {dashData?.meta && (
                            <div className="mb-3 pb-2 border-b border-border space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Cache Status:</span>
                                <span className={`font-semibold ${
                                  dashData.meta.cacheStatus === 'fresh' ? 'text-green-600' :
                                  dashData.meta.cacheStatus === 'refreshed_forced' || dashData.meta.cacheStatus === 'refreshed_no_cache' || dashData.meta.cacheStatus === 'refreshed_auto' ? 'text-blue-600' :
                                  dashData.meta.cacheStatus === 'stale_but_served' ? 'text-yellow-600' :
                                  dashData.meta.cacheStatus === 'error_fallback_to_cache' ? 'text-red-600' :
                                  'text-gray-600'
                                }`}>
                                  {dashData.meta.cacheStatus || 'unknown'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Cache Age:</span>
                                <span className="font-semibold">
                                  {dashData.meta.cacheAge !== undefined 
                                    ? dashData.meta.cacheAge === 0 
                                      ? 'Just now' 
                                      : dashData.meta.cacheAge < 60 
                                        ? `${dashData.meta.cacheAge}s ago`
                                        : dashData.meta.cacheAge < 3600
                                          ? `${Math.floor(dashData.meta.cacheAge / 60)}m ago`
                                          : `${Math.floor(dashData.meta.cacheAge / 3600)}h ago`
                                    : 'unknown'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Computed At:</span>
                                <span className="font-semibold">
                                  {dashData.meta.computedAt ? new Date(dashData.meta.computedAt).toLocaleString() : 'unknown'}
                                </span>
                              </div>
                              {dashData.meta.ordersCount !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Orders Count:</span>
                                  <span className="font-semibold">{dashData.meta.ordersCount}</span>
                                </div>
                              )}
                              {dashData.meta.productsCount !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Products Count:</span>
                                  <span className="font-semibold">{dashData.meta.productsCount}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Revenue Data */}
                          <div className="font-bold text-muted-foreground mb-1">Monthly Revenue:</div>
                          {actualSalesData.map((d: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span>{d.month}:</span>
                              <span className="font-semibold">
                                ${d.revenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-border pt-1 mt-1 font-bold">
                            <span>Total:</span>
                            <span>
                              ${actualSalesData.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Order Volume Chart (Cases) */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isCommerceData ? 'Order Volume (Bottles)' : 'Lead Generation'}
                    {isCommerceData && <span className="text-xs text-muted-foreground ml-2">(Commerce 7 Data)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={actualSalesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis 
                        label={{ value: isCommerceData ? 'Bottles' : 'Leads', angle: -90, position: 'insideLeft' }}
                        tickFormatter={formatNumber}
                      />
                      <Tooltip 
                        formatter={(value: number) => {
                          if (isCommerceData) {
                            return `${value.toLocaleString()} bottles`;
                          }
                          return value.toLocaleString();
                        }} 
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey={isCommerceData ? "bottles" : "leads"} 
                        stroke="#82ca9d" 
                        fill="#82ca9d" 
                        fillOpacity={0.3}
                        name={isCommerceData ? "Bottles" : "Leads"}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top SKU Chart (Last 30 Days) */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Top SKU (Last 30 Days)
                    {isCommerceData && <span className="text-xs text-muted-foreground ml-2">(Commerce 7 Data)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topSku ? (
                    <div className="h-[300px] flex flex-col justify-center items-center space-y-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-primary">{topSku.productTitle || topSku.sku}</p>
                        <p className="text-sm text-muted-foreground mt-1">{topSku.sku}</p>
                        <p className="text-xs text-muted-foreground mt-1">Most Sold Product</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6 w-full max-w-xs">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <p className="text-2xl font-semibold">{topSku.quantity.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">Bottles Sold</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <p className="text-2xl font-semibold">${topSku.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
                        </div>
                      </div>
                      <div className="text-center p-3 bg-primary/10 rounded-lg w-full max-w-xs">
                        <p className="text-lg font-medium">{Math.round(topSku.quantity / 12)} Cases</p>
                        <p className="text-xs text-muted-foreground mt-1">Total Cases Sold</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <p className="text-muted-foreground">No SKU data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="pipeline">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Wholesale Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">${(wholesaleStateData.reduce((sum, s) => sum + s.revenue, 0) / 1000000).toFixed(2)}M</p>
                  <p className="text-xs text-muted-foreground mt-1">Across {wholesaleStateData.length} states</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Bottles Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{(wholesaleStateData.reduce((sum, s) => sum + s.bottles, 0) / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(wholesaleStateData.reduce((sum, s) => sum + s.bottles, 0) / 12).toLocaleString()} cases</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Market Share</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{(wholesaleStateData.reduce((sum, s) => sum + s.marketShare, 0) / wholesaleStateData.length).toFixed(1)}%</p>
                  <p className="text-xs text-emerald-600 mt-1">↑ {(regionalData.reduce((sum, r) => sum + r.yoyGrowth, 0) / regionalData.length).toFixed(0)}% YoY</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{wholesaleStateData.reduce((sum, s) => sum + s.accounts, 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{wholesaleStateData.reduce((sum, s) => sum + s.distributors, 0)} distributors</p>
                </CardContent>
              </Card>
            </div>

            {/* Top States & Regional Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 States by Revenue */}
              <Card>
                <CardHeader>
                  <CardTitle>Top States by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={wholesaleStateData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <YAxis dataKey="state" type="category" width={100} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Regional Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Regional Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={regionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" />
                      <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
                          if (name === 'YoY Growth') return [`${value}%`, name];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue" />
                      <Bar yAxisId="right" dataKey="yoyGrowth" fill="#82ca9d" name="YoY Growth" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Market Penetration & Growth Opportunities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Share by State */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Penetration by State</CardTitle>
                  <p className="text-sm text-muted-foreground">Actual vs Potential Market Share</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {wholesaleStateData.slice(0, 8).map((state) => {
                      const penetration = (state.revenue / state.marketPotential) * 100;
                      return (
                        <div key={state.state} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{state.state}</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold">{state.marketShare}%</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({penetration.toFixed(1)}% of potential)
                              </span>
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(penetration, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>${(state.revenue / 1000).toFixed(0)}K</span>
                            <span>Potential: ${(state.marketPotential / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Growth Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle>Growth Opportunity States</CardTitle>
                  <p className="text-sm text-muted-foreground">High potential markets for expansion</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {opportunityStates.map((opp) => (
                      <div key={opp.state} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            opp.priority === 1 ? 'bg-red-100 text-red-700' :
                            opp.priority === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            #{opp.priority}
                          </div>
                          <div>
                            <p className="font-medium">{opp.state}</p>
                            <p className="text-xs text-muted-foreground">
                              {opp.currentShare > 0 ? `Current: ${opp.currentShare}%` : 'Not yet entered'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600">${(opp.gap / 1000).toFixed(0)}K</p>
                          <p className="text-xs text-muted-foreground">{opp.potential} potential</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distributor Performance & State Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Distributors */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Distributor Partners</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {distributorData.map((dist, index) => (
                      <div key={dist.name} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{dist.name}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span>{dist.accounts} accounts</span>
                            <span>•</span>
                            <span>{dist.states} states</span>
                            <span>•</span>
                            <span className="text-emerald-600">{dist.performance}% performance</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(dist.revenue / 1000).toFixed(0)}K</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* State Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Year-over-Year Growth by State</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wholesaleStateData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="state" angle={-45} textAnchor="end" height={80} />
                      <YAxis label={{ value: 'YoY Growth %', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Growth']} />
                      <Bar dataKey="yoyGrowth" fill="#82ca9d">
                        {wholesaleStateData.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.yoyGrowth > 20 ? '#10b981' : entry.yoyGrowth > 15 ? '#3b82f6' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="customers">
          <div className="space-y-6">
            {/* Customer Analytics - Efficient Order-Driven Approach */}
            {dashData?.customerAnalytics && (
              <>
                {/* Debug Info */}
                {dashData.customerAnalytics.debug && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span>Active Customers (90d): <strong>{dashData.customerAnalytics.debug.customerIdsInOrders90d}</strong></span>
                        <span>Customers Resolved: <strong>{dashData.customerAnalytics.debug.customersResolved}/{dashData.customerAnalytics.debug.customersResolved + dashData.customerAnalytics.debug.customersMissing}</strong></span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top 5 Customers for Outreach (90d Revenue) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Customers (90d) - Priority Outreach</CardTitle>
                    <p className="text-sm text-muted-foreground">Highest revenue customers in last 90 days</p>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(dashData.customerAnalytics?.topCustomers90d) && dashData.customerAnalytics.topCustomers90d.length > 0 ? (
                      <div className="space-y-3">
                        {dashData.customerAnalytics.topCustomers90d.map((customer, idx) => (
                          <div key={customer.customerId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{customer.name}</p>
                                <p className="text-sm text-muted-foreground">{customer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">${customer.revenue90d.toFixed(0)}</p>
                              <p className="text-sm text-muted-foreground">{customer.orders90d} orders · {customer.bottles90d} bottles</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No customer data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top 5 New Customers (30d First Purchase) */}
                <Card>
                  <CardHeader>
                    <CardTitle>New Customers (30d) - Welcome Engagement</CardTitle>
                    <p className="text-sm text-muted-foreground">Most recent first-time purchasers</p>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(dashData.customerAnalytics?.newCustomers30d) && dashData.customerAnalytics.newCustomers30d.length > 0 ? (
                      <div className="space-y-3">
                        {dashData.customerAnalytics.newCustomers30d.map((customer, idx) => (
                          <div key={customer.customerId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 font-semibold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{customer.name}</p>
                                <p className="text-sm text-muted-foreground">{customer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">${customer.firstOrderRevenue.toFixed(0)}</p>
                              <p className="text-sm text-muted-foreground">{new Date(customer.firstOrderDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No new customers in last 30 days</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top 5 LTV Customers (120d Window) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Spend (T12M)</CardTitle>
                    <p className="text-sm text-muted-foreground">Highest spending customers in trailing 12 months</p>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(dashData.customerAnalytics?.topLtv) && dashData.customerAnalytics.topLtv.length > 0 ? (
                      <div className="space-y-3">
                        {dashData.customerAnalytics.topLtv.map((customer, idx) => (
                          <div key={customer.customerId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 font-semibold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{customer.name}</p>
                                <p className="text-sm text-muted-foreground">{customer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-purple-600">${customer.revenue365d?.toFixed(0) || customer.revenue120d?.toFixed(0) || 0}</p>
                              <p className="text-sm text-muted-foreground">{customer.orders365d || customer.orders120d || 0} orders · {customer.bottles365d || customer.bottles120d || 0} bottles</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No customer data available</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Fallback for missing customer data */}
            {!dashData?.customerAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Customer analytics data is currently unavailable.</p>
                </CardContent>
              </Card>
            )}
            
            {/* Show error details if customer analytics failed (empty arrays + debug info) */}
            {dashData?.customerAnalytics?.debug?.message && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Customer Analytics Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Customer analytics failed at stage: <strong>{dashData.customerAnalytics.debug.stage || 'unknown'}</strong>
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                      View error details
                    </summary>
                    <div className="mt-2 p-3 bg-muted rounded font-mono text-xs space-y-2">
                      <div>
                        <strong>Stage:</strong>
                        <p className="mt-1">{dashData.customerAnalytics.debug.stage || 'unknown'}</p>
                      </div>
                      <div>
                        <strong>Message:</strong>
                        <p className="text-destructive mt-1">{dashData.customerAnalytics.debug.message}</p>
                      </div>
                      {dashData.customerAnalytics.debug.stack && (
                        <div>
                          <strong>Stack trace:</strong>
                          <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                            {dashData.customerAnalytics.debug.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="space-y-6">
      {currentRole === 'accounting' && renderAccountingCharts()}
      {currentRole === 'enterprise' && renderEnterpriseCharts()}
      {currentRole === 'sales' && renderSalesCharts()}
    </div>
  );
}