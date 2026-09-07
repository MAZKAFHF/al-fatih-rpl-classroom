import { NextResponse } from "next/server";
import { getDb, generateId, nowIso } from "@/lib/db";
import { signToken, cookieOptions, COOKIE_NAME_CONST, verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { code, displayName } = body as { code: string; displayName: string };
  if (!code || !displayName) return NextResponse.json({ error: "Kode kelas dan nama wajib diisi" }, { status: 400 });
  if (displayName.trim().length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter" }, { status: 400 });
  if (displayName.trim().length > 40) return NextResponse.json({ error: "Nama maksimal 40 karakter" }, { status: 400 });

  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE code=?").get(code.trim().toUpperCase()) as any;
  if (!classroom) return NextResponse.json({ error: "Kode kelas tidak ditemukan" }, { status: 404 });
  if (classroom.is_locked) return NextResponse.json({ error: "Kelas terkunci, tidak dapat bergabung" }, { status: 403 });

  const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' LIMIT 1").get(classroom.id) as any;
  if (!session) return NextResponse.json({ error: "Kelas belum dimulai oleh guru" }, { status: 400 });

  // Check if already has token and is valid student? Allow re-join
  // Create guest token for this student
  const guestId = generateId();
  const token = signToken({
    id: guestId,
    username: `guest_${guestId.slice(0, 8)}`,
    name: displayName.trim(),
    role: "STUDENT",
    guest: true,
  });

  // create member entry (or reuse if same displayName? just create new)
  const memberId = generateId();
  const now = nowIso();
  db.prepare(
    "INSERT INTO classroom_members (id, session_id, user_id, display_name, role, joined_at) VALUES (?, ?, ?, ?, 'STUDENT', ?)"
  ).run(memberId, session.id, guestId, displayName.trim(), now);

  const res = NextResponse.json({
    ok: true,
    classroom: { id: classroom.id, name: classroom.name, subject: classroom.subject, code: classroom.code },
    session,
    memberId,
    guestId,
  });
  res.cookies.set(COOKIE_NAME_CONST, token, cookieOptions() as any);
  return res;
}
