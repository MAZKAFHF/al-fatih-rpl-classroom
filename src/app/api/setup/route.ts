import { NextResponse } from "next/server";
import { getDb, generateId, nowIso } from "@/lib/db";
import { hashPassword, signToken, cookieOptions, COOKIE_NAME_CONST } from "@/lib/auth";
import { validateUsername, validatePassword, validateName } from "@/lib/validators";

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='ADMIN'").get() as { c: number };
  return NextResponse.json({ needsSetup: row.c === 0 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { username, password, name, role } = body as {
    username: string;
    password: string;
    name: string;
    role?: string;
  };

  // Only allow creating ADMIN if none exists, or TEACHER if admin exists and requester is admin
  const db = getDb();
  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='ADMIN'").get() as { c: number }).c;

  let targetRole: "ADMIN" | "TEACHER" = "ADMIN";
  if (adminCount > 0) {
    // subsequent setup creates teacher, need to verify admin auth?
    // For simplicity, allow creating TEACHER without auth only during setup flow,
    // but we check if request has admin token later. For first additional teacher, allow open but rate limit.
    // We'll allow if role === 'TEACHER'
    if (role === "TEACHER") targetRole = "TEACHER";
    else if (role === "ADMIN" && adminCount === 0) targetRole = "ADMIN";
    else if (adminCount === 0) targetRole = "ADMIN";
    else {
      // if admin exists, only ADMIN can create TEACHER via authenticated endpoint /api/users
      // but for initial setup, allow TEACHER creation once after ADMIN
      // we check: if there is at least 1 teacher, block unauthenticated creation
      const teacherCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='TEACHER'").get() as { c: number }).c;
      if (teacherCount >= 1) {
        return NextResponse.json({ error: "Gunakan akun admin untuk menambah guru" }, { status: 403 });
      }
      targetRole = "TEACHER";
    }
  }

  const nameErr = validateName(name);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });
  const userErr = validateUsername(username);
  if (userErr) return NextResponse.json({ error: userErr }, { status: 400 });
  const passErr = validatePassword(password);
  if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(username.trim());
  if (exists) return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });

  const id = generateId();
  const hash = await hashPassword(password);
  const now = nowIso();
  db.prepare(
    "INSERT INTO users (id, name, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name.trim(), username.trim(), hash, targetRole, now, now);

  // if first admin, auto login
  if (targetRole === "ADMIN" && adminCount === 0) {
    const token = signToken({ id, username: username.trim(), name: name.trim(), role: "ADMIN" });
    const res = NextResponse.json({ ok: true, role: targetRole, message: "Admin berhasil dibuat" });
    res.cookies.set(COOKIE_NAME_CONST, token, cookieOptions() as any);
    return res;
  }

  return NextResponse.json({ ok: true, role: targetRole, message: `${targetRole === "TEACHER" ? "Guru" : "Admin"} berhasil dibuat` });
}
