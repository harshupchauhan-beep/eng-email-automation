"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  status: string;
  statsEligible: number;
  statsSent: number;
  statsDelivered: number;
  createdAt: string;
};

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);

  useEffect(() => {
    void fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Send is a snapshot plus background jobs. The browser never delivers bulk email."
        action={{ href: "/campaigns/new", label: "New campaign" }}
      />
      {items.length === 0 ? (
        <EmptyState title="No campaigns" description="Create a campaign to queue a bulk send." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Eligible</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Delivered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((campaign) => (
              <TableRow key={campaign.id} className="transition-colors hover:bg-muted/40">
                <TableCell>
                  <Link className="hover:underline" href={`/campaigns/${campaign.id}`}>
                    {campaign.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={campaign.status} />
                </TableCell>
                <TableCell className="font-mono">{campaign.statsEligible}</TableCell>
                <TableCell className="font-mono">{campaign.statsSent}</TableCell>
                <TableCell className="font-mono">{campaign.statsDelivered}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
