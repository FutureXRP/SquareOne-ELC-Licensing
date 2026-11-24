import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">SquareOne ELC Compliance Center</CardTitle>
          <CardDescription>Sign in with the account your director invited.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {configured ? null : (
            <p role="status" className="rounded-md bg-status-amber-bg px-3 py-2 text-sm text-status-amber">
              Sign-in is not configured for this deployment. Set the Supabase environment variables listed in
              .env.example.
            </p>
          )}
          <LoginForm disabled={!configured} />
          <p className="text-xs text-muted-foreground">
            Accounts are by invitation only. Ask the director if you need access.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
