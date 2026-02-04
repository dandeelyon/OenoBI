import { useState } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { MetricsCards } from "./components/MetricsCards";
import { ChartsSection } from "./components/ChartsSection";
import { AISuggestions } from "./components/AISuggestions";
import { QuickActions } from "./components/QuickActions";
import { InventoryMetrics } from "./components/InventoryMetrics";
import { DashExecProvider } from "./context/DashExecProvider";


export type UserRole = 'accounting' | 'enterprise' | 'sales';

export default function App() {
  const [timePeriod, setTimePeriod] = useState("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentRole, setCurrentRole] = useState<UserRole>("sales");

  const handleTimePeriodChange = (period: string) => {
    setTimePeriod(period);
  };

  const handleSearchQuery = (query: string) => {
    setSearchQuery(query);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    setSearchQuery(""); // Clear search when switching roles
  };

  const getRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'accounting':
        return 'Accounting Overview';
      case 'enterprise':
        return 'Enterprise Overview';
      case 'sales':
        return 'Sales Overview';
      default:
        return 'Business Overview';
    }
  };

  return (
    <DashExecProvider>
      <div className="min-h-screen bg-background">
        <DashboardHeader 
          onTimePeriodChange={handleTimePeriodChange}
          onSearchQuery={handleSearchQuery}
          onRoleChange={handleRoleChange}
          timePeriod={timePeriod}
          currentRole={currentRole}
        />
        
        <div className="p-6 space-y-6">
          {/* Key Metrics Section */}
          <section>
            <h2 className="mb-4">{getRoleTitle(currentRole)}</h2>
            <MetricsCards timePeriod={timePeriod} currentRole={currentRole} />
          </section>

          {/* Analytics Section - Full width */}
          <section>
            <h2 className="mb-4">Analytics</h2>
            <ChartsSection timePeriod={timePeriod} currentRole={currentRole} />
          </section>

          {/* AI & Actions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <h2 className="mb-4">AI Insights</h2>
              <AISuggestions 
                searchQuery={searchQuery} 
                timePeriod={timePeriod} 
                currentRole={currentRole} 
              />
            </section>

            <section>
              <h2 className="mb-4">Quick Actions</h2>
              <QuickActions currentRole={currentRole} />
            </section>
          </div>
        </div>
      </div>
    </DashExecProvider>
  );
}