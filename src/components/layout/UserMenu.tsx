import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";

export async function UserMenu() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="no-print flex items-center gap-3">
      <div className="hidden text-right text-xs leading-tight sm:block">
        <p className="font-medium">{session.displayName ?? session.email}</p>
        <p className="text-muted-foreground">{session.role ? ROLE_LABEL[session.role] : "No access"}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          <LogOut aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}
