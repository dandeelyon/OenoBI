import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  FileText, 
  Users, 
  TrendingUp, 
  Package, 
  CreditCard, 
  Calendar,
  Mail,
  Phone,
  BarChart3,
  Settings,
  Target,
  Truck,
  ShoppingCart
} from "lucide-react";
import { UserRole } from "../App";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  urgency?: 'high' | 'medium' | 'low';
  category: string;
}

interface QuickActionsProps {
  currentRole: UserRole;
}

export function QuickActions({ currentRole }: QuickActionsProps) {
  const getRoleSpecificActions = (role: UserRole): QuickAction[] => {
    const actions = {
      accounting: [
        {
          id: 'accounting-1',
          title: 'Approve Q3 Budget',
          description: 'Department budget requests require approval',
          icon: <FileText className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'financial'
        },
        {
          id: 'accounting-2',
          title: 'Review Capital Expenditures',
          description: '5 CapEx requests over $50k pending',
          icon: <CreditCard className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'financial'
        },
        {
          id: 'accounting-3',
          title: 'Board Financial Report',
          description: 'Prepare monthly financial presentation',
          icon: <BarChart3 className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'reporting'
        },
        {
          id: 'accounting-4',
          title: 'Tax Planning Review',
          description: 'Q3 tax optimization strategies',
          icon: <Target className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'planning'
        },
        {
          id: 'accounting-5',
          title: 'Audit Committee Meeting',
          description: 'Schedule quarterly audit review',
          icon: <Calendar className="h-4 w-4" />,
          urgency: 'low' as const,
          category: 'governance'
        },
        {
          id: 'accounting-6',
          title: 'Cash Flow Forecast',
          description: 'Update 6-month cash projection',
          icon: <TrendingUp className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'planning'
        }
      ],
      enterprise: [
        {
          id: 'enterprise-1',
          title: 'Production Line Audit',
          description: 'Review underperforming Line C efficiency',
          icon: <Settings className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'operations'
        },
        {
          id: 'enterprise-2',
          title: 'Supplier Contract Review',
          description: '3 key suppliers up for renewal',
          icon: <FileText className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'procurement'
        },
        {
          id: 'enterprise-3',
          title: 'Inventory Rebalancing',
          description: 'Electronics category requires restocking',
          icon: <Package className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'inventory'
        },
        {
          id: 'enterprise-4',
          title: 'Delivery Optimization',
          description: 'Address Week 3 delivery delays',
          icon: <Truck className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'logistics'
        },
        {
          id: 'enterprise-5',
          title: 'Team Training Schedule',
          description: 'Q3 operational excellence training',
          icon: <Users className="h-4 w-4" />,
          urgency: 'low' as const,
          category: 'people'
        },
        {
          id: 'enterprise-6',
          title: 'Quality Assurance Review',
          description: 'Document best practices guide',
          icon: <Target className="h-4 w-4" />,
          urgency: 'low' as const,
          category: 'quality'
        }
      ],
      sales: [
        {
          id: 'sales-1',
          title: 'Pipeline Review Meeting',
          description: 'Weekly sales pipeline assessment',
          icon: <TrendingUp className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'pipeline'
        },
        {
          id: 'sales-2',
          title: 'Enterprise Deal Strategy',
          description: 'Review $500k+ deals in negotiation',
          icon: <Target className="h-4 w-4" />,
          urgency: 'high' as const,
          category: 'deals'
        },
        {
          id: 'sales-3',
          title: 'Sales Team Expansion',
          description: 'Approve hiring for enterprise segment',
          icon: <Users className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'team'
        },
        {
          id: 'sales-4',
          title: 'Customer Retention Program',
          description: 'Launch small business retention initiative',
          icon: <ShoppingCart className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'retention'
        },
        {
          id: 'sales-5',
          title: 'Sales Training Program',
          description: 'Scale successful conversion tactics',
          icon: <BarChart3 className="h-4 w-4" />,
          urgency: 'low' as const,
          category: 'training'
        },
        {
          id: 'sales-6',
          title: 'Quarterly Sales Review',
          description: 'Prepare Q2 performance analysis',
          icon: <FileText className="h-4 w-4" />,
          urgency: 'medium' as const,
          category: 'reporting'
        }
      ]
    };

    return actions[role] || actions.accounting;
  };

  const actions = getRoleSpecificActions(currentRole);

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      financial: 'bg-blue-50 border-blue-200',
      operations: 'bg-orange-50 border-orange-200',
      sales: 'bg-green-50 border-green-200',
      reporting: 'bg-purple-50 border-purple-200',
      planning: 'bg-indigo-50 border-indigo-200',
      governance: 'bg-gray-50 border-gray-200',
      procurement: 'bg-yellow-50 border-yellow-200',
      inventory: 'bg-teal-50 border-teal-200',
      logistics: 'bg-cyan-50 border-cyan-200',
      people: 'bg-pink-50 border-pink-200',
      quality: 'bg-emerald-50 border-emerald-200',
      pipeline: 'bg-lime-50 border-lime-200',
      deals: 'bg-amber-50 border-amber-200',
      team: 'bg-rose-50 border-rose-200',
      retention: 'bg-violet-50 border-violet-200',
      training: 'bg-slate-50 border-slate-200'
    };
    return colorMap[category] || 'bg-gray-50 border-gray-200';
  };

  const getRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'accounting':
        return 'Accounting Actions';
      case 'enterprise':
        return 'Enterprise Actions';
      case 'sales':
        return 'Sales Actions';
      default:
        return 'Quick Actions';
    }
  };

  const highPriorityActions = actions.filter(action => action.urgency === 'high');
  const otherActions = actions.filter(action => action.urgency !== 'high');

  return (
    <div className="space-y-6">
      {/* High Priority Actions */}
      {highPriorityActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Urgent {getRoleTitle(currentRole)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {highPriorityActions.map((action) => (
              <div
                key={action.id}
                className={`p-3 rounded-lg border-2 ${getCategoryColor(action.category)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {action.icon}
                    <span className="font-medium">{action.title}</span>
                  </div>
                  <Badge variant={getUrgencyColor(action.urgency)}>
                    {action.urgency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {action.description}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    Take Action
                  </Button>
                  <Button size="sm" variant="outline">
                    Delegate
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regular Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{getRoleTitle(currentRole)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {otherActions.map((action) => (
            <div
              key={action.id}
              className={`p-3 rounded-lg border ${getCategoryColor(action.category)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {action.icon}
                  <span className="font-medium">{action.title}</span>
                </div>
                <Badge variant={getUrgencyColor(action.urgency)}>
                  {action.urgency}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {action.description}
              </p>
              <Button size="sm" variant="outline" className="w-full">
                View Details
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Communication Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentRole === 'accounting' && (
            <>
              <Button className="w-full justify-start" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Send Financial Update to Board
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Schedule Accounting Leadership Call
              </Button>
            </>
          )}
          {currentRole === 'enterprise' && (
            <>
              <Button className="w-full justify-start" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Update Operations Dashboard
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Call Supplier Management Meeting
              </Button>
            </>
          )}
          {currentRole === 'sales' && (
            <>
              <Button className="w-full justify-start" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Send Sales Performance Report
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Schedule Sales Team Standup
              </Button>
            </>
          )}
          <Button className="w-full justify-start" variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Cross-Department Coordination Meeting
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}