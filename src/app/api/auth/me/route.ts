import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 200 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ user: null }, { status: 200 });

  // verify user still exists (except guest)
  if (!payload.guest) {
    const db = getDb();
    const user = db.prepare("SELECT id, username, name, role FROM users WHERE id=?").get(payload.id) as any;
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user });
  }
  return NextResponse.json({ user: payload });
}
