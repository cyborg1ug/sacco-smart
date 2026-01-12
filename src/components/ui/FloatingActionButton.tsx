import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FABAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "success" | "warning" | "destructive";
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  className?: string;
}

const FloatingActionButton = ({ actions, className }: FloatingActionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getVariantClasses = (variant?: string) => {
    switch (variant) {
      case "success":
        return "bg-success text-success-foreground hover:bg-success/90";
      case "warning":
        return "bg-warning text-warning-foreground hover:bg-warning/90";
      case "destructive":
        return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
      default:
        return "bg-primary text-primary-foreground hover:bg-primary/90";
    }
  };

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3", className)}>
      {/* Action buttons */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col-reverse gap-3 mb-2"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  y: 20, 
                  scale: 0.8,
                  transition: { delay: (actions.length - index - 1) * 0.05 }
                }}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full shadow-lg transition-all",
                  getVariantClasses(action.variant)
                )}
              >
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                <action.icon className="h-5 w-5" />
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "active:scale-95"
        )}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm -z-10"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingActionButton;
