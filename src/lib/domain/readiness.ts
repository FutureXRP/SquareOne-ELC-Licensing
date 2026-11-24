import type { EvidenceStatus } from "@/lib/domain/status";

/**
 * Readiness metric (BUILD.md section 5).
 *
 *   readiness = verified applicable active instances / all applicable active instances
 *
 * - Approved not-applicable items leave both numerator and denominator.
 * - Unknown and missing items stay in the denominator.
 * - Zero applicable items is "N/A", never 0 or 100.
 * - Integer math in basis points; rounding is for display only.
 */

export const READINESS_DISCLAIMER =
  "Internal readiness indicator. Not an official compliance determination.";

export type ReadinessRow = {
  evidenceStatus: EvidenceStatus;
  /** A closed instance belongs to a finished cycle and is not active. */
  closedAt: string | null;
};

export type Readiness = {
  verified: number;
  applicable: number;
  /** 0..10000, or null when there is nothing applicable. */
  basisPoints: number | null;
};

export function computeReadiness(rows: readonly ReadinessRow[]): Readiness {
  let verified = 0;
  let applicable = 0;
  for (const row of rows) {
    if (row.closedAt !== null) continue;
    if (row.evidenceStatus === "not_applicable") continue;
    applicable += 1;
    if (row.evidenceStatus === "verified") verified += 1;
  }
  return {
    verified,
    applicable,
    basisPoints: applicable === 0 ? null : Math.floor((verified * 10_000) / applicable),
  };
}

/** "N/A", or a percentage with one decimal. Only a complete set displays as 100%. */
export function formatReadiness(readiness: Readiness): string {
  if (readiness.basisPoints === null) return "N/A";
  if (readiness.verified === readiness.applicable) return "100%";
  const tenths = Math.min(Math.round(readiness.basisPoints / 10), 999);
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
}
