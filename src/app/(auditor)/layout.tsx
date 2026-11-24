import { Suspense } from "react";
import { UserMenu } from "@/components/layout/UserMenu";

export default function AuditorLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-base font-semibold">SquareOne ELC <span className="font-normal text-muted-foreground">Auditor packet (read-only)</span></p>
          <Suspense fallback={<div className="h-8 w-24" />}><UserMenu /></Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
