"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
};

export default function SegmentsPage() {
  const [items, setItems] = useState<Segment[]>([]);

  async function load() {
    const res = await fetch("/api/segments");
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/segments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        filter: {
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          query: form.get("query") || undefined,
        },
      }),
    });
    (event.target as HTMLFormElement).reset();
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Segments"
        description="Reusable audience filters based on tags and search terms."
      />
      <Card className="mb-6 max-w-xl">
        <CardContent className="pt-6">
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input id="tags" name="tags" placeholder="newsletter, customers" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="query">Search query</Label>
              <Input id="query" name="query" />
            </div>
            <Button type="submit">Save segment</Button>
          </form>
        </CardContent>
      </Card>
      {items.length === 0 ? (
        <EmptyState title="No segments" description="Create a segment to reuse an audience." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((segment) => (
            <Card key={segment.id}>
              <CardContent className="pt-6">
                <div className="font-medium">{segment.name}</div>
                <p className="text-sm text-muted-foreground">{segment.description}</p>
                <div className="mt-2 font-mono text-sm">
                  {segment.contactCount.toLocaleString()} contacts
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
