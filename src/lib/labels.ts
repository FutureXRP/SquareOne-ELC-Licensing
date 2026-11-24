import type { AppRole } from "@/lib/auth/permissions";
import type { Enums } from "@/lib/database.types";

export const ACCESS_CLASS_LABEL: Record<Enums<"access_class">, string> = {
  general: "General (staff)",
  personnel: "Personnel (office and the staff member)",
  child_health: "Child health (granted staff only)",
  restricted: "Restricted (director only)",
};

/** The access classes a role may choose when uploading. The database enforces the same. */
export function uploadClasses(role: AppRole, childHealth = false) {
  const allowed: Enums<"access_class">[] =
    role === "director"
      ? ["personnel", "general", "child_health", "restricted"]
      : role === "admin_support"
        ? childHealth
          ? ["personnel", "general", "child_health"]
          : ["personnel", "general"]
        : ["personnel", "general"];
  return allowed.map((value) => ({ value, label: ACCESS_CLASS_LABEL[value] }));
}

export const FREQUENCY_LABEL: Record<Enums<"frequency_type">, string> = {
  one_time: "One time",
  recurring: "Recurring",
  expiration_based: "Follows the document's expiry",
  event_triggered: "Triggered by an event",
};

export const CRITICALITY_LABEL: Record<Enums<"criticality">, string> = {
  safety_critical: "Safety critical",
  regulatory: "Regulatory",
  accreditation: "Accreditation",
  internal: "Internal",
};

export const TASK_STATUS_LABEL: Record<Enums<"task_status">, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const options = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
