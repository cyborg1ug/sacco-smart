import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface FinStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "success" | "warning" | "destructive" | "info" | "default";
  trend?: { value: number; label?: string };
  highlighted?: boolean;
  index?: number;
}

const variantMap = {
  primary:     "stat-card-primary",
  success:     "stat-card-success",
  warning:     "stat-card-warning",
  destructive: "stat-card-destructive",
  info:        "stat-card-info",
  default:     "",
};

const iconColorMap = {
  primary:     "bg-primary/10 text-primary",
  success:     "bg-success/10 text-success",
  warning:     "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info:        "bg-info/10 text-info",
  default:     "bg-muted text-muted-foreground",
};

export default function FinStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  highlighted = false,
  index = 0,
}: FinStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card
        className={cn(
          "border overflow-hidden card-hover",
          variantMap[variant],
          highlighted && "ring-2 ring-primary/30"
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 truncate">
                {title}
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums leading-tight truncate">
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
              )}
              {trend && (
                <div className={cn(
                  "flex items-center gap-1 mt-2 text-xs font-medium",
                  trend.value >= 0 ? "text-success" : "text-destructive"
                )}>
                  <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
                  {trend.label && <span className="text-muted-foreground font-normal">{trend.label}</span>}
                </div>
              )}
            </div>
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              iconColorMap[variant]
            )}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
