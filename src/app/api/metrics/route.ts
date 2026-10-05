import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { getQueueMetrics } from "@/lib/queue/queues";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const [queues, failedJobs] = await Promise.all([
      getQueueMetrics(),
      prisma.campaignRecipient.count({
        where: { status: "FAILED" },
      }),
    ]);
    const heartbeat = await prisma.workerHeartbeat.findUnique({ where: { id: "primary" } });
    return NextResponse.json({
      queues,
      failedDeliveries: failedJobs,
      worker: heartbeat
        ? {
            lastSeenAt: heartbeat.lastSeenAt,
            hostname: heartbeat.hostname,
            pid: heartbeat.pid,
            metadata: heartbeat.metadata,
          }
        : null,
    });
  });
}
