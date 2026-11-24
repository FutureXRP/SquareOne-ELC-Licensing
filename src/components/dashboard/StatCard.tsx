import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  red: "text-status-red",
  amber: "text-status-amber",
  green: "text-status-green",
  neutral: "text-foreground",
} as const;

/** A computed count. Every card links to the filtered list behind the number. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASS;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums", TONE_CLASS[tone])}>{value}</p>
    </Link>
  );
}
