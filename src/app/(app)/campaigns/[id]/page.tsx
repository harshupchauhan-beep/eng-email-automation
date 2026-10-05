"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type ProgressPayload = {
  status: string;
  stats: Record<string, number>;
  send: { cancelAfter: string | null; eligibleCount: number } | null;
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ campaign: Record<string, unknown>; estimate?: { estimatedEligible: number } } | null>(
    null,
  );
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  async function load() {
    const [detail, prog] = await Promise.all([
      fetch(`/api/campaigns/${params.id}`).then((r) => r.json()),
      fetch(`/api/campaigns/${params.id}/progress`).then((r) => r.json()),
    ]);
    setData(detail);
    setProgress(prog);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [params.id]);

  const stats = progress?.stats ?? {};
  const eligible = stats.eligible || 1;
  const sentPct = Math.min(100, ((stats.sent ?? 0) / eligible) * 100);

  async function action(path: string, ok: string) {
    const res = await fetch(`/api/campaigns/${params.id}/${path}`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) toast.error(body.error ?? "Failed");
    else toast.success(ok);
    await load();
  }

  if (!data?.campaign) return <p>Loading…</p>;
  const campaign = data.campaign as {
    name: string;
    status: string;
    subject: string;
    fromName: string;
    fromEmail: string;
  };

  return (
    <div>
      <PageHeader title={campaign.name} description={campaign.subject} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={progress?.status ?? campaign.status} />
        <Button variant="outline" onClick={() => void action("pause", "Paused")}>
          Pause
        </Button>
        <Button variant="outline" onClick={() => void action("resume", "Resumed")}>
          Resume
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Cancel remaining</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel remaining deliveries?</AlertDialogTitle>
              <AlertDialogDescription>
                Cancellation prevents remaining queued deliveries where possible. Messages already accepted
                by the email provider cannot be recalled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep sending</AlertDialogCancel>
              <AlertDialogAction onClick={() => void action("cancel", "Cancelled remaining")}>
                Cancel remaining
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Alert className="mb-6">
        <AlertTitle>
          Audience {stats.eligible?.toLocaleString()} eligible · Sender {campaign.fromName} &lt;
          {campaign.fromEmail}&gt;
        </AlertTitle>
        <AlertDescription>
          Progress updates every two seconds from PostgreSQL campaign counters, not from Redis.
        </AlertDescription>
      </Alert>
      <Progress value={sentPct} className="mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Audience size" value={(stats.selected ?? 0).toLocaleString()} />
        <StatCard title="Eligible" value={(stats.eligible ?? 0).toLocaleString()} />
        <StatCard title="Queued" value={(stats.queued ?? 0).toLocaleString()} />
        <StatCard title="Processing" value={(stats.processing ?? 0).toLocaleString()} />
        <StatCard title="Sent" value={(stats.sent ?? 0).toLocaleString()} />
        <StatCard title="Delivered" value={(stats.delivered ?? 0).toLocaleString()} />
        <StatCard title="Failed" value={(stats.failed ?? 0).toLocaleString()} />
        <StatCard title="Bounced" value={(stats.bounced ?? 0).toLocaleString()} />
        <StatCard title="Complaints" value={(stats.complained ?? 0).toLocaleString()} />
        <StatCard title="Unsubscribed" value={(stats.unsubscribed ?? 0).toLocaleString()} />
      </div>
    </div>
  );
}
