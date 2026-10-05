"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";

type Job = {
  id: string;
  status: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
  failed: number;
  errorMessage?: string | null;
};

export default function ImportPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/contacts/import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setJob(data.job);
    poll(data.job.id);
  }

  async function poll(id: string) {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/contacts/import/${id}`);
      const data = await res.json();
      setJob(data.job);
      if (data.job?.status === "COMPLETED" || data.job?.status === "FAILED") {
        clearInterval(timer);
      }
    }, 1000);
  }

  return (
    <div>
      <PageHeader
        title="CSV import"
        description="The file is stored and processed by a worker in batches. Suppressed addresses are never re-enabled."
      />
      <Card className="max-w-xl overflow-hidden">
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary/10">
              <FileSpreadsheet className="size-8 text-primary" />
              <div>
                <div className="text-sm font-medium">Drop a CSV here or click to browse</div>
                <div className="mt-1 text-xs text-muted-foreground">Up to 30,000+ rows, processed in the background</div>
              </div>
              <Input name="file" type="file" accept=".csv,text/csv" required className="max-w-xs" />
            </label>
            <p className="text-xs text-muted-foreground">
              Required column: email. Optional: firstName, lastName, company, phone, tags, source.
              Use a pipe or comma to separate tags (for example <code>newsletter|customers</code>).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Start import</Button>
              <Button type="button" variant="outline" asChild>
                <a href="/templates/contacts-import-template.csv" download="contacts-import-template.csv">
                  <Download className="size-4" />
                  Download template
                </a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {job ? (
        <Card className="mt-6 max-w-xl">
          <CardContent className="space-y-1 pt-6 font-mono text-sm">
            <div>Status: {job.status}</div>
            <div>Total rows: {job.totalRows}</div>
            <div>Imported: {job.imported}</div>
            <div>Duplicates: {job.duplicates}</div>
            <div>Invalid: {job.invalid}</div>
            <div>Suppressed: {job.suppressed}</div>
            <div>Failed: {job.failed}</div>
            {job.errorMessage ? <div className="text-destructive">{job.errorMessage}</div> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
