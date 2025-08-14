import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Rocket, Satellite, CheckCircle, XCircle, LayoutGrid } from 'lucide-react';
import { UserOrder } from '@/hooks/useAllUserOrders';

export type MissionFilter = 'all' | 'pending' | 'launch' | 'orbit' | 'complete' | 'failed';

interface MissionFilterBarProps {
  orders: UserOrder[];
  activeFilter: MissionFilter;
  onFilterChange: (filter: MissionFilter) => void;
}

export const MissionFilterBar: React.FC<MissionFilterBarProps> = ({
  orders,
  activeFilter,
  onFilterChange
}) => {
  const getOrderCountByFilter = (filter: MissionFilter): number => {
    switch (filter) {
      case 'all':
        return orders.length;
      case 'pending':
        return orders.filter(order => 
          order.paymentStatus !== 'completed' && order.paymentStatus !== 'succeeded'
        ).length;
      case 'launch':
        return orders.filter(order => 
          (order.paymentStatus === 'completed' || order.paymentStatus === 'succeeded') &&
          (order.orderStatus === 'paid' || order.orderStatus === 'payment_pending')
        ).length;
      case 'orbit':
        return orders.filter(order => order.orderStatus === 'processing').length;
      case 'complete':
        return orders.filter(order => order.orderStatus === 'completed').length;
      case 'failed':
        return orders.filter(order => order.orderStatus === 'failed').length;
      default:
        return 0;
    }
  };

  const filterButtons = [
    {
      key: 'all' as MissionFilter,
      label: 'All Missions',
      icon: <LayoutGrid className="w-4 h-4" />,
      colorClass: 'text-foreground'
    },
    {
      key: 'pending' as MissionFilter,
      label: 'Mission Pending',
      icon: <Clock className="w-4 h-4" />,
      colorClass: 'text-yellow-600'
    },
    {
      key: 'launch' as MissionFilter,
      label: 'Getting Ready for Launch',
      icon: <Rocket className="w-4 h-4" />,
      colorClass: 'text-blue-600'
    },
    {
      key: 'orbit' as MissionFilter,
      label: 'In ORBIT',
      icon: <Satellite className="w-4 h-4" />,
      colorClass: 'text-purple-600'
    },
    {
      key: 'complete' as MissionFilter,
      label: 'Mission Complete',
      icon: <CheckCircle className="w-4 h-4" />,
      colorClass: 'text-green-600'
    },
    {
      key: 'failed' as MissionFilter,
      label: 'Mission Failed',
      icon: <XCircle className="w-4 h-4" />,
      colorClass: 'text-red-600'
    }
  ];

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Filter by Mission Stage</h3>
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((button) => {
          const count = getOrderCountByFilter(button.key);
          const isActive = activeFilter === button.key;
          
          return (
            <Button
              key={button.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterChange(button.key)}
              className={`flex items-center gap-2 ${
                isActive 
                  ? 'bg-gradient-primary text-foreground' 
                  : `hover:${button.colorClass} hover:border-current`
              }`}
              disabled={count === 0}
            >
              <span className={isActive ? 'text-foreground' : button.colorClass}>
                {button.icon}
              </span>
              <span>{button.label}</span>
              <Badge 
                variant="secondary" 
                className={`ml-1 ${
                  isActive 
                    ? 'bg-background/20 text-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>
      
      {activeFilter !== 'all' && (
        <div className="mt-3 text-sm text-muted-foreground">
          Showing {getOrderCountByFilter(activeFilter)} orders • 
          <Button 
            variant="link" 
            size="sm" 
            onClick={() => onFilterChange('all')}
            className="h-auto p-0 ml-1 text-accent hover:text-accent/80"
          >
            View all missions
          </Button>
        </div>
      )}
    </div>
  );
};