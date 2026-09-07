import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, generateId, generateClassroomCode, nowIso } from "@/lib/db";
import { validateClassName, validateSubject } from "@/lib/validators";

export async function GET() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  let rows: any[];
  if (payload.role === "ADMIN") {
    rows = db.prepare("SELECT * FROM classrooms ORDER BY created_at DESC").all() as any[];
  } else if (payload.role === "TEACHER") {
    rows = db.prepare("SELECT * FROM classrooms WHERE created_by=? ORDER BY created_at DESC").all(payload.id) as any[];
  } else {
    // students see all classrooms? filtered by existence
    rows = db.prepare("SELECT id, name, subject, code, description, is_locked, created_at FROM classrooms ORDER BY created_at DESC").all() as any[];
  }

  // attach session status
  const withSession = rows.map((r) => {
    const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").get(r.id) as any;
    return { ...r, activeSession: session || null };
  });

  return NextResponse.json({ classrooms: withSession });
}

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== "TEACHER" && payload.role !== "ADMIN")) {
    return NextResponse.json({ error: "Hanya guru yang dapat membuat kelas" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { name, subject, description } = body;

  const nErr = validateClassName(name);
  if (nErr) return NextResponse.json({ error: nErr }, { status: 400 });
  const sErr = validateSubject(subject);
  if (sErr) return NextResponse.json({ error: sErr }, { status: 400 });

  const db = getDb();
  const id = generateId();
  let code = generateClassroomCode();
  // ensure unique
  for (let i = 0; i < 5; i++) {
    const exists = db.prepare("SELECT id FROM classrooms WHERE code=?").get(code);
    if (!exists) break;
    code = generateClassroomCode();
  }
  const now = nowIso();
  db.prepare(
    "INSERT INTO classrooms (id, name, subject, description, code, created_by, is_locked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)"
  ).run(id, name.trim(), subject.trim(), (description || "").trim(), code, payload.id, now, now);

  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id);
  return NextResponse.json({ ok: true, classroom });
}
