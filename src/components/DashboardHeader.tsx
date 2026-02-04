import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Search, Bell, Settings, User, Calculator, Building2, TrendingUp, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { UserRole } from "../App";
import { useDashExecContext } from "../context/DashExecProvider";
import { useState } from "react";

interface DashboardHeaderProps {
  onTimePeriodChange: (period: string) => void;
  onSearchQuery: (query: string) => void;
  onRoleChange: (role: UserRole) => void;
  timePeriod: string;
  currentRole: UserRole;
}

export function DashboardHeader({ 
  onTimePeriodChange, 
  onSearchQuery, 
  onRoleChange,
  timePeriod,
  currentRole 
}: DashboardHeaderProps) {
  const { refresh } = useDashExecContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    console.log('🔵 [Header] Refresh button clicked!');
    setIsRefreshing(true);
    try {
      console.log('🔵 [Header] Calling refresh function...');
      await refresh();
      console.log('🔵 [Header] Refresh completed!');
    } catch (e) {
      console.error('🔵 [Header] Refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const roles = [
    { 
      id: 'sales' as UserRole, 
      label: 'Sales', 
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'bg-green-50 text-green-700 border-green-200'
    },
    { 
      id: 'enterprise' as UserRole, 
      label: 'Enterprise', 
      icon: <Building2 className="h-4 w-4" />,
      color: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    { 
      id: 'accounting' as UserRole, 
      label: 'Accounting', 
      icon: <Calculator className="h-4 w-4" />,
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    }
  ];

  const getCurrentRoleInfo = () => {
    return roles.find(role => role.id === currentRole);
  };

  const currentRoleInfo = getCurrentRoleInfo();

  return (
    <div className="flex items-center justify-between p-6 bg-card border-b">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-medium">OenoBI: Blackbird</h1>
        
        {/* Role Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View as:</span>
          <div className="flex gap-1">
            {roles.map((role) => (
              <Button
                key={role.id}
                variant={currentRole === role.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onRoleChange(role.id)}
                className={`flex items-center gap-2 ${
                  currentRole === role.id 
                    ? role.color
                    : 'hover:bg-muted'
                }`}
              >
                {role.icon}
                {role.label}
              </Button>
            ))}
          </div>
        </div>

        <Select value={timePeriod} onValueChange={onTimePeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={`Ask AI about ${currentRoleInfo?.label.toLowerCase()} insights...`}
            className="pl-10"
            onChange={(e) => onSearchQuery(e.target.value)}
          />
        </div>
        
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <Badge variant="outline" className={currentRoleInfo?.color}>
            {currentRoleInfo?.label}
          </Badge>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Force refresh data"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}