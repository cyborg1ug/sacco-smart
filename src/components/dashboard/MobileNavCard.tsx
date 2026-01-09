import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface MobileNavCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: number;
}

const MobileNavCard = ({ to, icon: Icon, title, description, badge }: MobileNavCardProps) => {
  return (
    <Link to={to}>
      <Card className="hover:bg-muted/50 transition-colors active:bg-muted">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{title}</p>
                {badge !== undefined && badge > 0 && (
                  <span className="shrink-0 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs">
                    {badge}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
};

export default MobileNavCard;
