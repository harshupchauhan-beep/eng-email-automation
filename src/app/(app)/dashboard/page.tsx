import Link from "next/link";
import {
  Users,
  UserCheck,
  ShieldOff,
  Send,
  Inbox,
  Loader,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquareWarning,
  UserMinus,
  Percent,
} from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  return (
    <div>
      <PageHeader
        title="Intelligence dashboard"
        description="Audience health, delivery performance, and live campaign status for the ICCPP Email Intelligence System."
      />
      {stats.databaseAvailable ? null : (
        <Alert className="mb-6">
          <AlertTitle>Database is not running</AlertTitle>
          <AlertDescription>
            Start Docker Desktop, then run <code>docker compose up -d postgres redis</code> and{" "}
            <code>npx prisma migrate deploy</code>. The dashboard will show live counts after that.
          </AlertDescription>
        </Alert>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Audience
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total contacts" value={stats.totalContacts.toLocaleString()} icon={Users} />
          <StatCard
            title="Active contacts"
            value={stats.activeContacts.toLocaleString()}
            icon={UserCheck}
            tone="good"
          />
          <StatCard
            title="Suppressed"
            value={stats.suppressedContacts.toLocaleString()}
            icon={ShieldOff}
            tone="warn"
          />
          <StatCard title="Campaigns sent" value={stats.campaignsSent.toLocaleString()} icon={Send} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Delivery
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Emails queued" value={stats.emailsQueued.toLocaleString()} icon={Inbox} />
          <StatCard title="Processing" value={stats.emailsProcessing.toLocaleString()} icon={Loader} />
          <StatCard
            title="Delivered"
            value={stats.delivered.toLocaleString()}
            icon={CheckCircle2}
            tone="good"
          />
          <StatCard title="Failed" value={stats.failed.toLocaleString()} icon={XCircle} tone="bad" />
          <StatCard title="Bounced" value={stats.bounced.toLocaleString()} icon={AlertTriangle} tone="bad" />
          <StatCard
            title="Complaints"
            value={stats.complaints.toLocaleString()}
            icon={MessageSquareWarning}
            tone="bad"
          />
          <StatCard
            title="Unsubscribed"
            value={stats.unsubscribed.toLocaleString()}
            icon={UserMinus}
            tone="warn"
          />
          <StatCard title="Delivery rate" value={pct(stats.deliveryRate)} icon={Percent} tone="good" />
          <StatCard title="Bounce rate" value={pct(stats.bounceRate)} icon={Percent} tone="warn" />
          <StatCard title="Complaint rate" value={pct(stats.complaintRate)} icon={Percent} tone="bad" />
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Recent campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recentCampaigns.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No campaigns yet"
                description="Create a campaign to start tracking delivery intelligence here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentCampaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="transition-colors hover:bg-muted/40">
                    <TableCell>
                      <Link
                        className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                        href={`/campaigns/${campaign.id}`}
                      >
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="font-mono">{campaign.statsEligible}</TableCell>
                    <TableCell className="font-mono">{campaign.statsSent}</TableCell>
                    <TableCell className="font-mono">{campaign.statsDelivered}</TableCell>
                    <TableCell className="font-mono">{campaign.statsFailed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
