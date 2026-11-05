import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/server/ai";
import { config } from "@/lib/server/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: aiConfigured() ? config.anthropicModel : undefined });
}
