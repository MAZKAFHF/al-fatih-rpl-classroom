import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

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
    return NextResponse.json({ error: "Tidak berhak" }, { status: 403 });
  }
  const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' LIMIT 1").get(id) as any;
  if (!session) return NextResponse.json({ error: "Tidak ada sesi aktif" }, { status: 400 });
  const now = nowIso();
  db.prepare("UPDATE classroom_sessions SET status='ended', ended_at=? WHERE id=?").run(now, session.id);
  db.prepare("UPDATE classroom_members SET left_at=? WHERE session_id=? AND left_at IS NULL").run(now, session.id);
  // clear raised hands
  db.prepare("UPDATE raised_hands SET cleared_at=? WHERE session_id=? AND cleared_at IS NULL").run(now, session.id);
  return NextResponse.json({ ok: true });
}
