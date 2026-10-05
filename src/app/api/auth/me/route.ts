import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser(request);
  if (error || !user) return error!;
  return NextResponse.json({ user });
}
