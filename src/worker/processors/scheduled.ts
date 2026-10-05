import { startScheduledCampaign } from "../../lib/campaigns/send";
import type { ScheduledJobData } from "../../lib/queue/types";

export async function processScheduled(data: ScheduledJobData) {
  await startScheduledCampaign(data.campaignId);
}
