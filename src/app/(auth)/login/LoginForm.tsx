"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = { error: null, email: "" };

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required disabled={disabled} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md bg-status-red-bg px-3 py-2 text-sm text-status-red">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={disabled || pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
