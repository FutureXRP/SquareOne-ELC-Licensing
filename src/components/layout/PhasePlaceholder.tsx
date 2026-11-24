import { Construction } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Stand-in for a screen that a later build phase delivers (BUILD.md section 9). */
export function PhasePlaceholder({ title, phase, summary }: { title: string; phase: number; summary: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="size-4 text-muted-foreground" aria-hidden />
            Not built yet
          </CardTitle>
          <CardDescription>Planned for build phase {phase}.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{summary}</p>
        </CardContent>
      </Card>
    </div>
  );
}
