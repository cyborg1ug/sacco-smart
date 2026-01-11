import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotificationsPopover from "./member/NotificationsPopover";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  accountNumber?: string;
  showBackButton?: boolean;
  isAdmin?: boolean;
  showNotifications?: boolean;
  onProfileClick?: () => void;
}

const DashboardHeader = ({
  title,
  subtitle,
  userName,
  accountNumber,
  showBackButton = false,
  isAdmin = false,
  showNotifications = false,
  onProfileClick,
}: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/auth");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between gap-4 py-2"
    >
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0 hover:bg-primary/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate tracking-tight">
              {title}
            </h1>
            {isAdmin && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {showNotifications && <NotificationsPopover />}
        <ThemeToggle />

        {isAdmin ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs sm:text-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        ) : userName ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
              >
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs sm:text-sm font-semibold">
                    {getInitials(userName || "U")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-t-md -mt-1 -mx-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
                    {getInitials(userName || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5 leading-none min-w-0">
                  <p className="font-semibold truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {accountNumber}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={onProfileClick}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4 shrink-0" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4 shrink-0" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </motion.header>
  );
};

export default DashboardHeader;