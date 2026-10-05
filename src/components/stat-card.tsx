import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const tones = {
    default: "text-primary",
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-destructive",
  };
  return (
    <Card className="group border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_40px_oklch(0.2_0.04_250/40%)]">
      <CardContent className="pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          {Icon ? (
            <span className={cn("rounded-lg bg-muted p-1.5", tones[tone])}>
              <Icon className="size-3.5" />
            </span>
          ) : null}
        </div>
        <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
