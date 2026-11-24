"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { IDLE, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** A form bound to a server action, with pending state and the action's message. */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant,
  size,
  className,
  inline = false,
  confirm,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  inline?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "flex flex-col gap-3", className)}
    >
      {children}
      <div className={cn(inline ? "contents" : "flex flex-wrap items-center gap-3")}>
        <Button type="submit" disabled={pending} variant={variant} size={size}>
          {pending ? "Working…" : submitLabel}
        </Button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={cn("min-w-0 break-words text-sm", state.ok ? "text-status-green" : "text-status-red")}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
