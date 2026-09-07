import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, signToken, cookieOptions, COOKIE_NAME_CONST } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (isRateLimited(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi 1 menit" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { username, password } = body as { username: string; password: string };
  if (!username || !password) return NextResponse.json({ error: "Username dan password wajib" }, { status: 400 });

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username.trim()) as any;
  if (!user) return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });

  const token = signToken({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
  res.cookies.set(COOKIE_NAME_CONST, token, cookieOptions() as any);
  return res;
}
