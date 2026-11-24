import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20", className)} {...props} />;
}

/**
 * Label + control, stacked. The control sits inside the <label>, so the association never
 * depends on ids (several forms on one page can use the same field names).
 */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  name?: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium leading-none">{label}</span>
        {children}
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  className,
  ...props
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <Input name={name} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  hint,
  options,
  blank,
  className,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  blank?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <Select name={name} {...props}>
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}
