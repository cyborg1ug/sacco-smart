import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning" | "info";
  trend?: {
    value: number;
    label: string;
  };
  highlighted?: boolean;
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    border: "",
  },
  primary: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    border: "border-primary/20",
  },
  success: {
    iconBg: "bg-success/10",
    iconColor: "text-success",
    border: "border-success/20",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    border: "border-warning/20",
  },
  info: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    border: "border-blue-500/20",
  },
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  highlighted = false,
  className,
}: StatCardProps) => {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
        styles.border,
        highlighted && "ring-2 ring-primary/50",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/20 pointer-events-none" />
      
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 truncate">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.value >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          
          <div
            className={cn(
              "shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;