import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  DRAFT: "border-border bg-muted text-muted-foreground",
  READY: "border-border bg-muted text-muted-foreground",
  PAUSED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SCHEDULED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  QUEUING: "border-primary/30 bg-primary/10 text-primary",
  QUEUED: "border-primary/30 bg-primary/10 text-primary",
  SENDING: "border-primary/30 bg-primary/10 text-primary",
  PARTIALLY_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  BOUNCED: "border-destructive/30 bg-destructive/10 text-destructive",
  COMPLAINED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED: "border-border bg-muted text-muted-foreground",
  SUPPRESSED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  UNSUBSCRIBED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px] capitalize", TONES[status] ?? "bg-muted")}
    >
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
