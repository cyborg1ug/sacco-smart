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
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 touch-manipulation",
        styles.border,
        highlighted && "ring-2 ring-primary/50",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/20 pointer-events-none" />
      
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide leading-tight">
              {title}
            </p>
            <p className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold mt-0.5 sm:mt-1 truncate leading-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-1 sm:mt-2">
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-medium",
                    trend.value >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          
          <div
            className={cn(
              "shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;