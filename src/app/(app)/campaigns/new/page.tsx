"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Estimate = {
  totalSelected: number;
  suppressed: number;
  invalid: number;
  estimatedEligible: number;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [preview, setPreview] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    fromName: "ICCPP",
    fromEmail: "noreply@example.com",
    replyTo: "",
    subject: "",
    preheader: "",
    templateId: "",
    audienceType: "ALL",
    segmentId: "",
    scheduledAt: "",
  });

  useEffect(() => {
    void Promise.all([fetch("/api/templates"), fetch("/api/segments"), fetch("/api/settings")]).then(
      async ([t, s, st]) => {
        const templatesJson = await t.json();
        const segmentsJson = await s.json();
        const settingsJson = await st.json();
        setTemplates(templatesJson.items ?? []);
        setSegments(segmentsJson.items ?? []);
        setForm((f) => ({
          ...f,
          fromEmail: settingsJson.env?.fromAddress ?? f.fromEmail,
          fromName: settingsJson.env?.fromName ?? f.fromName,
        }));
      },
    );
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    void fetch("/api/campaigns/audience", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audienceType: form.audienceType,
        segmentId: form.segmentId || undefined,
        audienceConfig: { segmentId: form.segmentId },
      }),
    })
      .then((r) => r.json())
      .then((d) => setEstimate(d.estimate));
  }, [step, form.audienceType, form.segmentId]);

  const large = (estimate?.estimatedEligible ?? 0) >= 1000;
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  async function createAndMaybeSend(send: boolean) {
    setSubmitting(true);
    const created = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        replyTo: form.replyTo || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        sendNow: !form.scheduledAt,
      }),
    }).then((r) => r.json());
    if (!created.campaign) {
      toast.error("Could not create campaign");
      setSubmitting(false);
      return;
    }
    if (send) {
      const sent = await fetch(`/api/campaigns/${created.campaign.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, idempotencyKey }),
      });
      if (!sent.ok) {
        toast.error("Send failed");
        setSubmitting(false);
        return;
      }
    }
    router.push(`/campaigns/${created.campaign.id}`);
  }

  return (
    <div>
      <PageHeader title="New campaign" description={`Step ${step} of 6`} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>
            {step === 1 && "Campaign information"}
            {step === 2 && "Select template"}
            {step === 3 && "Select audience"}
            {step === 4 && "Preview"}
            {step === 5 && "Test send"}
            {step === 6 && "Confirm send"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="grid gap-3">
              <Field label="Internal name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="From name">
                <Input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
              </Field>
              <Field label="From email">
                <Input value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
              </Field>
              <Field label="Reply-to">
                <Input value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} />
              </Field>
              <Field label="Subject">
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </Field>
              <Field label="Preheader">
                <Input value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} />
              </Field>
              <Field label="Schedule (UTC, optional)">
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <Select value={form.templateId} onValueChange={(templateId) => setForm({ ...form, templateId })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <Select
                value={form.audienceType}
                onValueChange={(audienceType) => setForm({ ...form, audienceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Entire eligible list</SelectItem>
                  <SelectItem value="TAGS">Tags</SelectItem>
                  <SelectItem value="SEGMENT">Saved segment</SelectItem>
                  <SelectItem value="MANUAL">Manual selection</SelectItem>
                </SelectContent>
              </Select>
              {form.audienceType === "SEGMENT" ? (
                <Select value={form.segmentId} onValueChange={(segmentId) => setForm({ ...form, segmentId })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {estimate ? (
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  <div>Total selected: {estimate.totalSelected.toLocaleString()}</div>
                  <div>Suppressed/ineligible: {estimate.suppressed.toLocaleString()}</div>
                  <div>Invalid: {estimate.invalid.toLocaleString()}</div>
                  <div>Eligible: {estimate.estimatedEligible.toLocaleString()}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Calculating audience…</p>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const created = await fetch("/api/campaigns", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ ...form, sendNow: true }),
                  }).then((r) => r.json());
                  if (!created.campaign) return;
                  const data = await fetch(`/api/campaigns/${created.campaign.id}/preview`).then((r) =>
                    r.json(),
                  );
                  setPreview(data.rendered?.html ?? "");
                  sessionStorage.setItem("draftCampaignId", created.campaign.id);
                }}
              >
                Generate personalized preview
              </Button>
              <iframe title="preview" className="h-80 w-full rounded-md border bg-white" srcDoc={preview} />
            </div>
          ) : null}

          {step === 5 ? (
            <TestSend />
          ) : null}

          {step === 6 ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>
                  This campaign will queue approximately{" "}
                  {(estimate?.estimatedEligible ?? 0).toLocaleString()} emails.
                </AlertTitle>
                <AlertDescription>
                  Sender: {form.fromName} &lt;{form.fromEmail}&gt; · Subject: {form.subject} · Suppressed:{" "}
                  {estimate?.suppressed ?? 0}. The HTTP request will not send mail; workers will.
                </AlertDescription>
              </Alert>
              {large ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(Boolean(v))} />
                  I confirm this large send and understand it cannot be fully recalled after provider acceptance.
                </label>
              ) : null}
              <p className="text-xs text-muted-foreground">
                A short cancellation window applies after confirmation. Double-clicks are ignored via an
                idempotency key.
              </p>
            </div>
          ) : null}

          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < 6 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            ) : (
              <Button
                disabled={submitting || (large && !confirm) || !form.name || !form.subject}
                onClick={() => void createAndMaybeSend(true)}
              >
                {submitting ? "Queuing…" : "Send campaign"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TestSend() {
  const [to, setTo] = useState("");
  return (
    <div className="space-y-2">
      <Label>Test recipient</Label>
      <div className="flex gap-2">
        <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const draftId = sessionStorage.getItem("draftCampaignId");
            if (!draftId) {
              toast.message("Generate a preview first so a draft campaign exists.");
              return;
            }
            const res = await fetch(`/api/campaigns/${draftId}/test`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ to }),
            });
            if (res.ok) toast.success("Test sent");
            else toast.error("Test failed");
          }}
        >
          Send test
        </Button>
      </div>
    </div>
  );
}
