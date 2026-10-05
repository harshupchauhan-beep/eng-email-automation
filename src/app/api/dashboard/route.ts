import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { getDashboardStats } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  return withApi(request, async () => NextResponse.json(await getDashboardStats()));
}
