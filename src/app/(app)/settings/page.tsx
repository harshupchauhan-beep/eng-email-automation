"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const [data, setData] = useState<{
    env: Record<string, string | number | boolean>;
    checklist: Record<string, boolean>;
    settings: Record<string, unknown>;
  } | null>(null);
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string }[]>([]);

  async function load() {
    const settings = await fetch("/api/settings").then((r) => r.json());
    setData(settings);
    setOrgName(String(settings.settings.orgName ?? settings.env.fromName ?? ""));
    setAddress(String(settings.settings.physicalAddress ?? ""));
    const usersRes = await fetch("/api/users");
    if (usersRes.ok) {
      const body = await usersRes.json();
      setUsers(body.items ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgName, physicalAddress: address }),
    });
    toast.success("Settings saved");
    await load();
  }

  async function toggle(key: string, value: boolean) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    await load();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    });
    if (res.ok) {
      toast.success("User created");
      (event.target as HTMLFormElement).reset();
      await load();
    } else toast.error("Could not create user");
  }

  if (!data) return <p>Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Provider credentials stay on the server. This page never exposes API keys."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization identity</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={save}>
              <div className="space-y-1">
                <Label>Organization name</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Physical mailing address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <Button type="submit">Save</Button>
            </form>
            <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
              <div>Provider: {String(data.env.provider)}</div>
              <div>From: {String(data.env.fromAddress)}</div>
              <div>Concurrency: {String(data.env.workerConcurrency)}</div>
              <div>Rate limit: {String(data.env.rateLimit)} / sec</div>
              <div>Webhook: {String(data.env.webhookUrl)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deliverability checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.checklist).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span>{key}</span>
                {["spfConfigured", "dkimConfigured", "dmarcConfigured", "domainVerified", "webhooksConfigured"].includes(
                  key,
                ) ? (
                  <Switch checked={Boolean(data.settings[key])} onCheckedChange={(v) => void toggle(key, v)} />
                ) : (
                  <span className="font-mono text-xs">{value ? "yes" : "no"}</span>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              SPF, DKIM, and DMARC must be configured at the DNS / provider console. This app does not
              rotate domains, bypass suppression, or disguise senders.
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Users (admin created only)</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="mb-4 grid gap-2 md:grid-cols-5" onSubmit={createUser}>
              <Input name="name" placeholder="Name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Password (12+)" required minLength={12} />
              <Input name="role" placeholder="ADMIN | OPERATOR | VIEWER" defaultValue="OPERATOR" />
              <Button type="submit">Create user</Button>
            </form>
            <div className="space-y-1 text-sm">
              {users.map((u) => (
                <div key={u.id} className="flex justify-between font-mono text-xs">
                  <span>{u.email}</span>
                  <span>{u.role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
