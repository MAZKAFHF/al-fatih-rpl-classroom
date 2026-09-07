import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, generateClassroomCode, nowIso } from "@/lib/db";

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
  if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let code = generateClassroomCode();
  for (let i = 0; i < 5; i++) {
    const exists = db.prepare("SELECT id FROM classrooms WHERE code=?").get(code);
    if (!exists) break;
    code = generateClassroomCode();
  }
  const now = nowIso();
  db.prepare("UPDATE classrooms SET code=?, updated_at=? WHERE id=?").run(code, now, id);
  return NextResponse.json({ ok: true, code });
}
