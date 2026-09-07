import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();
  const classroom = db.prepare("SELECT id, name, subject, description, code, is_locked FROM classrooms WHERE code=?").get(code.toUpperCase()) as any;
  if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' LIMIT 1").get(classroom.id) as any;
  return NextResponse.json({ classroom, hasActiveSession: !!session });
}
