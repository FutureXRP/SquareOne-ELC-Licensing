import Link from "next/link";
import { Suspense } from "react";
import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { READINESS_DISCLAIMER } from "@/lib/domain/readiness";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-3">
          <Link href="/" className="text-base font-semibold">
            SquareOne ELC <span className="font-normal text-muted-foreground">Compliance Center</span>
          </Link>
          <Suspense fallback={<div className="h-8 w-24" />}>
            <UserMenu />
          </Suspense>
        </div>
        <div className="mx-auto w-full max-w-6xl px-1 pt-1 sm:px-4">
          <Suspense fallback={<div className="h-10" />}>
            <MainNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>
      </main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
        {READINESS_DISCLAIMER}
      </footer>
    </div>
  );
}
