import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST, hashPassword } from "@/lib/auth";
import { getDb, generateId, nowIso } from "@/lib/db";
import { validateName, validateUsername, validatePassword } from "@/lib/validators";

export async function GET() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const db = getDb();
  const users = db.prepare("SELECT id, name, username, role, created_at FROM users ORDER BY created_at DESC").all();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { name, username, password, role } = body as { name: string; username: string; password: string; role: string };
  if (!["ADMIN", "TEACHER", "STUDENT"].includes(role)) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });

  const nErr = validateName(name);
  if (nErr) return NextResponse.json({ error: nErr }, { status: 400 });
  const uErr = validateUsername(username);
  if (uErr) return NextResponse.json({ error: uErr }, { status: 400 });
  const pErr = validatePassword(password);
  if (pErr) return NextResponse.json({ error: pErr }, { status: 400 });

  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(username.trim());
  if (exists) return NextResponse.json({ error: "Username sudah dipakai" }, { status: 409 });

  const id = generateId();
  const hash = await hashPassword(password);
  const now = nowIso();
  db.prepare("INSERT INTO users (id, name, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id,
    name.trim(),
    username.trim(),
    hash,
    role,
    now,
    now
  );
  return NextResponse.json({ ok: true, user: { id, name, username, role } });
}
