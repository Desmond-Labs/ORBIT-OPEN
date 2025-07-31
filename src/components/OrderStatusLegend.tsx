import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Rocket, Satellite, CheckCircle, XCircle } from 'lucide-react';

interface StatusLegendItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  subtitle?: string;
}

const statusItems: StatusLegendItem[] = [
  {
    icon: <Clock className="w-4 h-4" />,
    label: "Mission Pending",
    description: "User uploaded images, payment not complete",
    color: "text-yellow-600 bg-yellow-100"
  },
  {
    icon: <Rocket className="w-4 h-4" />,
    label: "Getting Ready for Launch",
    description: "Payment completed, queued for processing",
    subtitle: "Please allow 24 hrs",
    color: "text-blue-600 bg-blue-100"
  },
  {
    icon: <Satellite className="w-4 h-4" />,
    label: "In ORBIT",
    description: "Order actively being processed",
    color: "text-purple-600 bg-purple-100"
  },
  {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "Mission Complete",
    description: "All processing finished",
    color: "text-green-600 bg-green-100"
  },
  {
    icon: <XCircle className="w-4 h-4" />,
    label: "Mission Failed",
    description: "Processing failed",
    color: "text-red-600 bg-red-100"
  }
];

export const OrderStatusLegend: React.FC = () => {
  return (
    <Card className="cosmic-border bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg gradient-text flex items-center">
          <Satellite className="w-5 h-5 mr-2" />
          Mission Status Guide
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statusItems.map((item, index) => (
            <div key={index} className="flex flex-col space-y-2">
              <Badge variant="outline" className={`${item.color} justify-start`}>
                {item.icon}
                <span className="ml-2 font-medium">{item.label}</span>
              </Badge>
              <div className="text-xs text-muted-foreground px-1">
                <p>{item.description}</p>
                {item.subtitle && (
                  <p className="italic text-accent mt-1">{item.subtitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};