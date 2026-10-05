import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { enqueueImport } from "@/lib/queue/queues";

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user }) => {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith(".csv")) {
        return NextResponse.json({ error: "Only CSV files are accepted" }, { status: 400 });
      }
      const job = await prisma.importJob.create({
        data: {
          filename: file.name,
          filePath: "",
          createdById: user.id,
        },
      });
      const dir = path.join(process.cwd(), "uploads", "imports");
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${job.id}.csv`);
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, bytes);
      await prisma.importJob.update({
        where: { id: job.id },
        data: { filePath },
      });
      await enqueueImport(job.id);
      return NextResponse.json({ job: { ...job, filePath } }, { status: 202 });
    },
    { role: "OPERATOR" },
  );
}
