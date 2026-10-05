"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Template = {
  id: string;
  name: string;
  currentVersion?: { subject: string; version: number } | null;
};

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);

  useEffect(() => {
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, []);

  async function duplicate(id: string) {
    await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
    const d = await fetch("/api/templates").then((r) => r.json());
    setItems(d.items ?? []);
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Versioned HTML and plain-text templates with safe {{variable}} substitution."
        action={{ href: "/templates/new", label: "New template" }}
      />
      {items.length === 0 ? (
        <EmptyState title="No templates" description="Create a reusable email template." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((template) => (
            <Card key={template.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div>
                  <Link href={`/templates/${template.id}`} className="font-medium hover:underline">
                    {template.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {template.currentVersion?.subject} · v{template.currentVersion?.version ?? 0}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void duplicate(template.id)}>
                  Duplicate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
