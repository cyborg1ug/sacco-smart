import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface EnhancedMobileNavCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: number;
  variant?: "default" | "primary" | "accent";
  index?: number;
}

const EnhancedMobileNavCard = ({
  to,
  icon: Icon,
  title,
  description,
  badge,
  variant = "default",
  index = 0,
}: EnhancedMobileNavCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link to={to}>
        <Card
          className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:shadow-md active:scale-[0.98]",
            variant === "primary" && "border-primary/30 bg-primary/5",
            variant === "accent" && "border-accent/30 bg-accent/5"
          )}
        >
          {/* Hover gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={cn(
                  "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                  variant === "primary"
                    ? "bg-primary text-primary-foreground"
                    : variant === "accent"
                    ? "bg-accent text-accent-foreground"
                    : "bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">
                    {title}
                  </p>
                  {badge !== undefined && badge > 0 && (
                    <span className="shrink-0 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium animate-pulse">
                      {badge}
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};

export default EnhancedMobileNavCard;