"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { renderEmail } from "@/lib/email/render";

const DEFAULT_HTML = `<h1>Hello {{firstName}}</h1>
<p>This message is for {{company}}.</p>`;
const DEFAULT_TEXT = `Hello {{firstName}}

This message is for {{company}}.`;

export default function NewTemplatePage() {
  const router = useRouter();
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [subject, setSubject] = useState("Hello {{firstName}}");
  const [preheader, setPreheader] = useState("");
  const [text, setText] = useState(DEFAULT_TEXT);

  const preview = renderEmail({
    subject,
    preheader,
    html,
    text,
    vars: { firstName: "Alex", lastName: "Rivera", company: "Example Co", email: "alex@example.com" },
    fallbacks: { firstName: "there" },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        subject,
        preheader,
        htmlBody: html,
        textBody: text,
        fallbacks: { firstName: "there" },
      }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/templates/${data.template.id}`);
  }

  return (
    <div>
      <PageHeader title="New template" description="Variables are HTML-escaped. Missing values use fallbacks." />
      <form className="grid gap-6 lg:grid-cols-2" onSubmit={onSubmit}>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Preheader</Label>
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>HTML</Label>
              <Textarea className="min-h-48 font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Plain text</Label>
              <Textarea className="min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <Button type="submit">Save template</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="mb-2 text-sm font-medium">{preview.subject}</div>
            <div className="mb-4 text-xs text-muted-foreground">{preview.preheader}</div>
            <iframe
              title="Preview"
              className="h-96 w-full rounded-md border bg-white"
              srcDoc={preview.html}
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
