"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

type Row = {
  id: string;
  email: string;
  reason: string;
  source: string | null;
  createdAt: string;
};

export default function SuppressionPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [email, setEmail] = useState("");

  async function load() {
    const data = await fetch("/api/suppression").then((r) => r.json());
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/suppression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, reason: "MANUAL" }),
    });
    setEmail("");
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Suppression list"
        description="Unsubscribes, hard bounces, complaints, and manual blocks. Marketing mail is never sent to these addresses."
      />
      <form className="mb-4 flex max-w-lg gap-2" onSubmit={onSubmit}>
        <Input
          type="email"
          required
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit">Suppress</Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.email}</TableCell>
              <TableCell>
                <StatusBadge status={row.reason} />
              </TableCell>
              <TableCell>{row.source ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{new Date(row.createdAt).toISOString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
