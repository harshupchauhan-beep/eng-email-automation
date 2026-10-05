"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Search } from "lucide-react";

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  status: string;
  tags: { tag: { name: string } }[];
};

export default function ContactsPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (q) params.set("q", q);
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/contacts?${params.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
  }

  useEffect(() => {
    void load();
  }, [page, status]);

  async function archiveSelected() {
    await Promise.all(
      [...selected].map((id) => fetch(`/api/contacts/${id}`, { method: "DELETE" })),
    );
    setSelected(new Set());
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Search, filter, and import permission-based recipients. Tables are paginated."
        action={{ href: "/contacts/import", label: "Import CSV" }}
      >
        <Button variant="outline" asChild>
          <a href="/templates/contacts-import-template.csv" download="contacts-import-template.csv">
            <Download className="size-4" />
            Download template
          </a>
        </Button>
      </PageHeader>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 p-3">
        <Input
          placeholder="Search email, name, company"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              void load();
            }
          }}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {["ALL", "ACTIVE", "UNSUBSCRIBED", "BOUNCED", "COMPLAINED", "SUPPRESSED"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void load()}>
          <Search className="size-4" />
          Search
        </Button>
        <Button variant="outline" asChild>
          <a href="/api/contacts/export">Export CSV</a>
        </Button>
        {selected.size > 0 ? (
          <Button variant="destructive" onClick={() => void archiveSelected()}>
            Archive {selected.size}
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No contacts" description="Import a CSV or create a contact to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((contact) => (
              <TableRow key={contact.id} className="transition-colors hover:bg-muted/40">
                <TableCell>
                  <Checkbox
                    checked={selected.has(contact.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(contact.id);
                      else next.delete(contact.id);
                      setSelected(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{contact.email}</TableCell>
                <TableCell>
                  {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell>{contact.company ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {contact.tags.map((t) => t.tag.name).join(", ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} contacts · page {page}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 25 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        <Link href="/contacts/import" className="underline">
          Streamed CSV import
        </Link>{" "}
        supports 30,000+ rows.
      </div>
    </div>
  );
}
