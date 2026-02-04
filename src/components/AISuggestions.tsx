import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { UserRole } from "../App";

interface Suggestion {
  id: string;
  type: 'opportunity' | 'warning' | 'action';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionText: string;
  priority: number;
}

interface AISuggestionsProps {
  searchQuery: string;
  timePeriod: string;
  currentRole: UserRole;
}

export function AISuggestions({ searchQuery, timePeriod, currentRole }: AISuggestionsProps) {
  const getRoleSpecificSuggestions = (role: UserRole, query: string, period: string): Suggestion[] => {
    const suggestions = {
      accounting: [
        {
          id: 'accounting-1',
          type: 'opportunity' as const,
          title: 'Operating Margin Improvement',
          description: 'Operating margin increased to 24.3% this month. Consider scaling successful cost optimization initiatives across other departments.',
          impact: 'high' as const,
          actionText: 'Review Cost Structure',
          priority: 1
        },
        {
          id: 'accounting-2',
          type: 'action' as const,
          title: 'Q3 Budget Planning',
          description: 'Strong Q2 performance creates opportunity for increased R&D investment. Review budget allocations for strategic initiatives.',
          impact: 'high' as const,
          actionText: 'Schedule Budget Meeting',
          priority: 2
        },
        {
          id: 'accounting-3',
          type: 'warning' as const,
          title: 'Cash Flow Monitoring',
          description: 'While positive, cash flow growth has slowed to 22.8%. Monitor upcoming capital expenditures and working capital needs.',
          impact: 'medium' as const,
          actionText: 'Review Cash Forecast',
          priority: 3
        },
        {
          id: 'accounting-4',
          type: 'opportunity' as const,
          title: 'Tax Optimization',
          description: 'Current profit margins suggest potential for tax-efficient investment strategies before year-end.',
          impact: 'medium' as const,
          actionText: 'Consult Tax Advisor',
          priority: 4
        }
      ],
      enterprise: [
        {
          id: 'enterprise-1',
          type: 'opportunity' as const,
          title: 'Production Efficiency Gains',
          description: 'Manufacturing efficiency reached 89.2%, up 6.8%. Scale successful practices to underperforming production lines.',
          impact: 'high' as const,
          actionText: 'Audit Production Lines',
          priority: 1
        },
        {
          id: 'enterprise-2',
          type: 'action' as const,
          title: 'Inventory Optimization',
          description: 'Electronics category showing 6.2x turnover rate. Consider increasing allocation by 20% for Q3.',
          impact: 'high' as const,
          actionText: 'Update Procurement Plan',
          priority: 2
        },
        {
          id: 'enterprise-3',
          type: 'warning' as const,
          title: 'Delivery Performance Risk',
          description: 'On-time delivery at 96.1% but showing variability. Week 3 dipped to 92% - investigate bottlenecks.',
          impact: 'medium' as const,
          actionText: 'Review Logistics Chain',
          priority: 3
        },
        {
          id: 'enterprise-4',
          type: 'opportunity' as const,
          title: 'Quality Metrics Excellence',
          description: 'Quality scores consistently above 95%. Document best practices for knowledge transfer.',
          impact: 'medium' as const,
          actionText: 'Create Quality Playbook',
          priority: 4
        }
      ],
      sales: [
        {
          id: 'sales-1',
          type: 'opportunity' as const,
          title: 'Conversion Rate Surge',
          description: 'Conversion rate improved to 4.2%, up 24.1%. Scale successful tactics across all sales teams.',
          impact: 'high' as const,
          actionText: 'Analyze Top Performers',
          priority: 1
        },
        {
          id: 'sales-2',
          type: 'action' as const,
          title: 'Pipeline Acceleration',
          description: 'Pipeline value at $2.1M represents 28.4% growth. Focus on moving deals from Proposal to Negotiation stage.',
          impact: 'high' as const,
          actionText: 'Review Deal Progression',
          priority: 2
        },
        {
          id: 'sales-3',
          type: 'opportunity' as const,
          title: 'Enterprise Segment Growth',
          description: 'Enterprise customers showing highest satisfaction (92%) and revenue per customer. Expand enterprise sales team.',
          impact: 'high' as const,
          actionText: 'Plan Team Expansion',
          priority: 1
        },
        {
          id: 'sales-4',
          type: 'warning' as const,
          title: 'Small Business Retention',
          description: 'Small business segment satisfaction at 85%. Risk of churn if not addressed proactively.',
          impact: 'medium' as const,
          actionText: 'Launch Retention Campaign',
          priority: 3
        }
      ]
    };

    let roleSuggestions = suggestions[role] || suggestions.accounting;

    // Filter by search query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      roleSuggestions = roleSuggestions.filter(s => 
        s.title.toLowerCase().includes(queryLower) || 
        s.description.toLowerCase().includes(queryLower)
      );
    }

    return roleSuggestions.sort((a, b) => a.priority - b.priority);
  };

  const suggestions = getRoleSpecificSuggestions(currentRole, searchQuery, timePeriod);

  const getTypeIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'action':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTypeColor = (type: Suggestion['type']) => {
    switch (type) {
      case 'opportunity':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'action':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getImpactVariant = (impact: Suggestion['impact']) => {
    switch (impact) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'accounting':
        return 'Accounting';
      case 'enterprise':
        return 'Enterprise';
      case 'sales':
        return 'Sales';
      default:
        return 'Business';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {getRoleLabel(currentRole)} AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {searchQuery && (
          <Alert>
            <AlertDescription>
              Showing {getRoleLabel(currentRole).toLowerCase()} insights for: "{searchQuery}"
            </AlertDescription>
          </Alert>
        )}
        
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No specific insights found for your query.</p>
            <p className="text-sm mt-2">
              Try searching for terms related to {getRoleLabel(currentRole).toLowerCase()} operations
            </p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`p-4 rounded-lg border-2 ${getTypeColor(suggestion.type)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getTypeIcon(suggestion.type)}
                  <h4 className="font-medium">{suggestion.title}</h4>
                </div>
                <Badge variant={getImpactVariant(suggestion.impact)}>
                  {suggestion.impact} impact
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                {suggestion.description}
              </p>
              
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full justify-between"
              >
                {suggestion.actionText}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}