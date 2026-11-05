import { NextResponse } from "next/server";
import { getUser, publicUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    return NextResponse.json({ user: user ? publicUser(user) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[auth/me]", e);
    return NextResponse.json({ user: null, error: "Account service unavailable." }, { status: 503 });
  }
}
