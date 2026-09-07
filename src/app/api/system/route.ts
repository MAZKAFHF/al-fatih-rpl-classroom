import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM system_settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  rows.forEach((r) => (settings[r.key] = r.value));
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const db = getDb();
  const allowed = ["school_name", "max_students", "max_file_size_mb", "session_timeout_hours"];
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.includes(k)) continue;
    db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?").run(k, String(v), String(v));
  }
  return NextResponse.json({ ok: true });
}
