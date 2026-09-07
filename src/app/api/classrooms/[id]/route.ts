import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  // allow guest? but need at least valid code path - allow any authenticated or even anonymous to view basic info
  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id) as any;
  if (!classroom) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").get(id) as any;
  const materials = db.prepare("SELECT * FROM materials WHERE classroom_id=? ORDER BY created_at DESC").all(id);
  return NextResponse.json({ classroom, activeSession: session || null, materials });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== "TEACHER" && payload.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id) as any;
  if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id) {
    return NextResponse.json({ error: "Tidak berhak mengubah kelas ini" }, { status: 403 });
  }
  const { name, subject, description, is_locked } = body;
  const now = nowIso();
  db.prepare("UPDATE classrooms SET name=COALESCE(?, name), subject=COALESCE(?, subject), description=COALESCE(?, description), is_locked=COALESCE(?, is_locked), updated_at=? WHERE id=?").run(
    name?.trim() || null,
    subject?.trim() || null,
    description != null ? description.trim() : null,
    typeof is_locked === "boolean" ? (is_locked ? 1 : 0) : typeof is_locked === "number" ? is_locked : null,
    now,
    id
  );
  const updated = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id);
  return NextResponse.json({ ok: true, classroom: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== "TEACHER" && payload.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(id) as any;
  if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id) {
    return NextResponse.json({ error: "Tidak berhak menghapus" }, { status: 403 });
  }
  db.prepare("DELETE FROM classrooms WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
