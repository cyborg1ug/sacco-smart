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
      className="flex items-center justify-between gap-2 sm:gap-4 py-2"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0 hover:bg-primary/10 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate tracking-tight">
              {title}
            </h1>
            {isAdmin && (
              <Badge variant="secondary" className="shrink-0 gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
                <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden xs:inline">Admin</span>
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        {showNotifications && <NotificationsPopover />}
        <ThemeToggle />

        {isAdmin ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-[10px] sm:text-xs md:text-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-8 sm:h-9 px-2 sm:px-3"
          >
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5 md:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        ) : userName ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all p-0"
              >
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-[10px] sm:text-xs md:text-sm font-semibold">
                    {getInitials(userName || "U")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 sm:w-60">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-t-md -mt-1 -mx-1">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs sm:text-sm font-semibold">
                    {getInitials(userName || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5 leading-none min-w-0">
                  <p className="text-sm sm:text-base font-semibold truncate">{userName}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {accountNumber}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={onProfileClick}
                className="cursor-pointer text-sm"
              >
                <User className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
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