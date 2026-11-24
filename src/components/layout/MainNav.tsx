"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/staff", label: "Staff" },
  { href: "/licensing", label: "Licensing" },
  { href: "/stars", label: "STARS" },
  { href: "/apple", label: "APPLE" },
  { href: "/files/staff", label: "Files", match: "/files" },
  { href: "/safety", label: "Safety" },
  { href: "/reports", label: "Reports" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="no-print -mb-px flex gap-1 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const base = "match" in item ? item.match : item.href;
        const active = base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(`${base}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
