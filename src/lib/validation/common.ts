import { z } from "zod";
import { isDateOnly } from "@/lib/dates";

export const uuid = z.uuid();
export const optionalUuid = z.uuid().optional();
export const dateOnly = z.string().refine(isDateOnly, "Use a valid date.");
export const optionalDate = dateOnly.optional();
export const text = (max = 200) => z.string().min(1, "Required.").max(max);
export const optionalText = (max = 500) => z.string().max(max).optional();
export const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
