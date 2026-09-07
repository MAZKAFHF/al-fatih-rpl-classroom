import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, generateId, nowIso } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== "TEACHER" && payload.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id) as any;
  if (!classroom) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id) {
    return NextResponse.json({ error: "Tidak berhak memulai kelas ini" }, { status: 403 });
  }
  const existing = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' LIMIT 1").get(id) as any;
  if (existing) return NextResponse.json({ ok: true, session: existing, message: "Kelas sudah aktif" });

  const sessionId = generateId();
  const now = nowIso();
  db.prepare("INSERT INTO classroom_sessions (id, classroom_id, status, started_at) VALUES (?, ?, 'active', ?)").run(sessionId, id, now);
  const session = db.prepare("SELECT * FROM classroom_sessions WHERE id=?").get(sessionId);
  return NextResponse.json({ ok: true, session });
}
