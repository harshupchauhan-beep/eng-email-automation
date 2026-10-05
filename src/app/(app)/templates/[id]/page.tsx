"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { renderEmail } from "@/lib/email/render";

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [testTo, setTestTo] = useState("");
  const [versions, setVersions] = useState<{ id: string; version: number }[]>([]);

  useEffect(() => {
    void fetch(`/api/templates/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setName(d.template.name);
        setSubject(d.template.currentVersion?.subject ?? "");
        setPreheader(d.template.currentVersion?.preheader ?? "");
        setHtml(d.template.currentVersion?.htmlBody ?? "");
        setText(d.template.currentVersion?.textBody ?? "");
        setVersions(d.template.versions ?? []);
      });
  }, [params.id]);

  const preview = renderEmail({
    subject,
    preheader,
    html,
    text,
    vars: { firstName: "Alex", lastName: "Rivera", company: "Example Co", email: "alex@example.com" },
    fallbacks: { firstName: "there" },
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/templates/${params.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, subject, preheader, htmlBody: html, textBody: text }),
    });
    if (res.ok) toast.success("New template version saved");
  }

  async function sendTest() {
    const res = await fetch(`/api/templates/${params.id}/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: testTo }),
    });
    if (res.ok) toast.success("Test email queued through the configured provider");
    else toast.error("Test send failed");
  }

  return (
    <div>
      <PageHeader title={name || "Template"} description={`Versions: ${versions.map((v) => v.version).join(", ")}`} />
      <form className="grid gap-6 lg:grid-cols-2" onSubmit={save}>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Preheader</Label>
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
            </div>
            <Textarea className="min-h-48 font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
            <Textarea className="min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit">Save new version</Button>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="test@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => void sendTest()}>
                Send test
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <iframe title="Preview" className="h-[32rem] w-full rounded-md border bg-white" srcDoc={preview.html} />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
