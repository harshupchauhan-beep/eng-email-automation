import { ContactStatus } from "@prisma/client";
import { prisma } from "./db";
import { logger } from "./logger";

export type DashboardStats = {
  totalContacts: number;
  activeContacts: number;
  suppressedContacts: number;
  campaignsSent: number;
  emailsQueued: number;
  emailsProcessing: number;
  delivered: number;
  failed: number;
  bounced: number;
  complaints: number;
  unsubscribed: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  recentCampaigns: {
    id: string;
    name: string;
    status: string;
    statsEligible: number;
    statsQueued: number;
    statsProcessing: number;
    statsSent: number;
    statsDelivered: number;
    statsFailed: number;
    statsBounced: number;
    statsComplained: number;
    createdAt: Date;
  }[];
  databaseAvailable: boolean;
};

export function emptyDashboardStats(): DashboardStats {
  return {
    totalContacts: 0,
    activeContacts: 0,
    suppressedContacts: 0,
    campaignsSent: 0,
    emailsQueued: 0,
    emailsProcessing: 0,
    delivered: 0,
    failed: 0,
    bounced: 0,
    complaints: 0,
    unsubscribed: 0,
    deliveryRate: 0,
    bounceRate: 0,
    complaintRate: 0,
    recentCampaigns: [],
    databaseAvailable: false,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      totalContacts,
      activeContacts,
      suppressedContacts,
      campaignsSent,
      recentCampaigns,
      deliveryAgg,
    ] = await Promise.all([
      prisma.contact.count({ where: { archivedAt: null } }),
      prisma.contact.count({ where: { archivedAt: null, status: "ACTIVE" } }),
      prisma.suppression.count(),
      prisma.campaign.count({
        where: { status: { in: ["COMPLETED", "PARTIALLY_FAILED", "SENDING", "QUEUED", "QUEUING"] } },
      }),
      prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          status: true,
          statsEligible: true,
          statsQueued: true,
          statsProcessing: true,
          statsSent: true,
          statsDelivered: true,
          statsFailed: true,
          statsBounced: true,
          statsComplained: true,
          createdAt: true,
        },
      }),
      prisma.campaign.aggregate({
        _sum: {
          statsQueued: true,
          statsProcessing: true,
          statsSent: true,
          statsDelivered: true,
          statsFailed: true,
          statsBounced: true,
          statsComplained: true,
          statsUnsubscribed: true,
        },
      }),
    ]);

    const sums = deliveryAgg._sum;
    const queued = sums.statsQueued ?? 0;
    const processing = sums.statsProcessing ?? 0;
    const delivered = sums.statsDelivered ?? 0;
    const failed = sums.statsFailed ?? 0;
    const bounced = sums.statsBounced ?? 0;
    const complaints = sums.statsComplained ?? 0;
    const unsubscribed = sums.statsUnsubscribed ?? 0;
    const sent = sums.statsSent ?? 0;
    const denom = sent || 1;

    return {
      totalContacts,
      activeContacts,
      suppressedContacts,
      campaignsSent,
      emailsQueued: queued,
      emailsProcessing: processing,
      delivered,
      failed,
      bounced,
      complaints,
      unsubscribed,
      deliveryRate: sent ? delivered / denom : 0,
      bounceRate: sent ? bounced / denom : 0,
      complaintRate: sent ? complaints / denom : 0,
      recentCampaigns,
      databaseAvailable: true,
    };
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "dashboard stats unavailable",
    );
    return emptyDashboardStats();
  }
}

export const CONTACT_STATUSES: ContactStatus[] = [
  "ACTIVE",
  "UNSUBSCRIBED",
  "BOUNCED",
  "COMPLAINED",
  "SUPPRESSED",
  "ARCHIVED",
];
