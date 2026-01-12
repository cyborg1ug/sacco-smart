import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface CardField {
  label: string;
  value: ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface MobileCardProps {
  fields: CardField[];
  status?: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  actions?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const MobileCard = ({ fields, status, actions, className, onClick }: MobileCardProps) => {
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all hover:shadow-md",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {fields.filter(f => !f.hideOnMobile).map((field, index) => (
              <div key={index} className={cn("flex flex-col", field.className)}>
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  {field.label}
                </span>
                <span className="text-xs sm:text-sm font-medium truncate">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {status && (
              <Badge variant={status.variant} className="text-[9px] sm:text-[10px]">
                {status.label}
              </Badge>
            )}
            {actions && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  renderTable: () => ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function MobileCardList<T>({ 
  items, 
  renderCard, 
  renderTable,
  emptyMessage = "No items found",
  className 
}: MobileCardListProps<T>) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((item, index) => renderCard(item, index))}
      </div>
    );
  }

  return renderTable();
}

export default MobileCardList;
