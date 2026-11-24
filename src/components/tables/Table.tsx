import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("border-b border-border py-2 pr-4 text-left font-medium text-muted-foreground", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-border py-2 pr-4 align-top", className)}>{children}</td>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="no-print flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
