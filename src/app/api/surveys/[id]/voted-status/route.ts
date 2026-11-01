// app/api/surveys/[id]/voted-status/route.ts
import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { extractClientIp, hashIpAddress } from "@/lib/phone";
import crypto from "crypto";
import type { VoteDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext) {
  const {id:surveyId} = await ctx?.params;

  if (!/^[0-9a-fA-F]{24}$/.test(surveyId)) {
    return NextResponse.json({ voted: false, reasons: [] }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const deviceId: string | undefined =
    typeof body?.deviceId === "string" && body.deviceId.length > 0
      ? body.deviceId
      : undefined;
  if (!deviceId) {
    return NextResponse.json(
      { voted: false, reasons: [], error: "deviceId missing" },
      { status: 400 }
    );
  }

  // Derive hashes
  const deviceHash = crypto.createHash("sha256").update(deviceId.trim()).digest("hex");
  const ip = extractClientIp(req);
  const ipHash = hashIpAddress(ip);
  const votesCol = await getCollection<VoteDoc>("votes");

  const reasons: string[] = [];

  // Device
  const byDevice = await votesCol.findOne(
    { surveyId, deviceHash },
    { projection: { _id: 1 } }
  );
  if (byDevice) reasons.push("device");

  // IP — because of CGNAT, we do NOT block here. We report it so the
  // client / admin can see "this IP has voted before", but the wizard
  // is not locked on IP alone.
  const byIp = await votesCol.findOne(
    { surveyId, ipHash },
    { projection: { _id: 1 } }
  );
  if (byIp) reasons.push("ip");

  // IP is informational; only a previously used device blocks another ballot.
  const voted = reasons.includes("device");

  return NextResponse.json({ voted, reasons, ip });
}