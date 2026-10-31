import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { enqueueImport } from "@/lib/queue/queues";
import { putImportCsv } from "@/lib/storage";

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
      const bytes = Buffer.from(await file.arrayBuffer());
      const filePath = await putImportCsv(job.id, bytes);
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
