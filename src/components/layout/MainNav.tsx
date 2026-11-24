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

const MORE_ITEMS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/review", label: "Review queue" },
  { href: "/training", label: "Training" },
  { href: "/requirements", label: "Requirements" },
  { href: "/policies", label: "Policies" },
  { href: "/calendar", label: "Calendar" },
  { href: "/upload", label: "Upload" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, base: string) {
  return base === "/" ? pathname === "/" || pathname.startsWith("/items") : pathname === base || pathname.startsWith(`${base}/`);
}

export function MainNav() {
  const pathname = usePathname();
  return (
    <div className="no-print">
      <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, "match" in item ? item.match : item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="More" className="flex gap-x-4 gap-y-1 overflow-x-auto border-t border-border py-1.5 text-xs">
        {MORE_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={cn("whitespace-nowrap px-3 py-1", isActive(pathname, item.href) ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
