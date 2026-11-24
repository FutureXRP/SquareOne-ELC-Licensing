import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const session = await requireSession();
  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-status-red" aria-hidden />
            {session.role === null ? "Your account is not active" : "You do not have access to that page"}
          </CardTitle>
          <CardDescription>Signed in as {session.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {session.role === null
              ? "A director needs to activate your account and assign a role before you can see anything here."
              : "Ask the director if you think you should be able to see it."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
