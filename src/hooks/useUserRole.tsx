import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserRoleState {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
}

/**
 * Resolves the current user's roles from the user_roles table.
 * - isSuperAdmin: can edit transaction details (amount, date, description) and delete.
 * - isAdmin: can record and approve, but not rewrite financial details.
 */
export const useUserRole = (): UserRoleState => {
  const [state, setState] = useState<UserRoleState>({ isAdmin: false, isSuperAdmin: false, loading: true });

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setState({ isAdmin: false, isSuperAdmin: false, loading: false });
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data || []).map((r) => r.role as string);
      if (mounted) {
        setState({
          isAdmin: roles.includes("admin") || roles.includes("super_admin"),
          isSuperAdmin: roles.includes("super_admin"),
          loading: false,
        });
      }
    };

    resolve();
    return () => { mounted = false; };
  }, []);

  return state;
};
