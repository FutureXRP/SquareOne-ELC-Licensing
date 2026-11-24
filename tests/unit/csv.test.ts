import { describe, expect, it } from "vitest";
import { previewImport, type ImportLookups } from "@/lib/csv/imports";
import { csvCell, parseCsv, toCsv } from "@/lib/csv/parse";

const lookups: ImportLookups = {
  employeeCodes: new Set(["syn-003"]),
  classrooms: new Set(["river otters"]),
  credentialTypes: new Set(["food handler permit"]),
  existingKeys: new Set(["syn-003|synthetic course a|2026-03-14|"]),
};

describe("parseCsv", () => {
  it("handles quotes, embedded commas, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n')).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  });
});

describe("csv export", () => {
  it("quotes when needed and neutralises spreadsheet formulas", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("previewImport", () => {
  it("reports a missing required column before anything else", () => {
    const p = previewImport("training", "employee_code,course_title\nSYN-003,X", lookups);
    expect(p.headerProblem).toContain("completion_date");
    expect(p.rows).toHaveLength(0);
  });

  it("validates each row and names the problem", () => {
    const csv = [
      "employee_code,course_title,completion_date,minutes",
      "SYN-003,New course,2026-04-01,90",
      "SYN-003,Bad date,04/01/2026,90",
      "SYN-003,Fractional,2026-04-02,1.5",
      "SYN-999,Unknown person,2026-04-02,60",
    ].join("\n");
    const p = previewImport("training", csv, lookups);
    expect(p.rows.map((r) => r.status)).toEqual(["ready", "error", "error", "error"]);
    expect(p.rows[1].problem).toContain("completion_date");
    expect(p.rows[2].problem).toContain("minutes");
    expect(p.rows[3].problem).toContain("No staff member");
    expect(p.rows[1].line).toBe(3);
  });

  it("flags records already on file and repeats inside the file, case-insensitively", () => {
    const csv = [
      "employee_code,course_title,completion_date,minutes",
      "SYN-003,SYNTHETIC COURSE A,2026-03-14,120",
      "syn-003,Fresh course,2026-05-01,60",
      "SYN-003,fresh course,2026-05-01,60",
    ].join("\n");
    const p = previewImport("training", csv, lookups);
    expect(p.rows.map((r) => r.status)).toEqual(["duplicate", "ready", "duplicate"]);
    expect(p.rows[0].problem).toBe("Already on file.");
    expect(p.rows[2].problem).toBe("Repeated in this file.");
  });

  it("checks classrooms and credential types against what exists", () => {
    const staff = previewImport("staff", "employee_code,first_name,last_name,classroom\nSYN-100,Sample,Pine,River Otters\nSYN-101,Sample,Yew,Nowhere", lookups);
    expect(staff.rows.map((r) => r.status)).toEqual(["ready", "error"]);
    const creds = previewImport("credentials", "employee_code,credential_type,expiration_date\nSYN-003,Food handler permit,2027-01-01\nSYN-003,Made up,2027-01-01", lookups);
    expect(creds.rows.map((r) => r.status)).toEqual(["ready", "error"]);
  });
});
