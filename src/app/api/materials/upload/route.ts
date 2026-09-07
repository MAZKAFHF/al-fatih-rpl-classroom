import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb, generateId, nowIso } from "@/lib/db";
import path from "path";
import fs from "fs";
import { ALLOWED_EXTENSIONS, sanitizeFilename } from "@/lib/validators";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== "TEACHER" && payload.role !== "ADMIN")) {
    return NextResponse.json({ error: "Hanya guru dapat upload" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  const file = formData.get("file") as File | null;
  const classroomId = formData.get("classroomId") as string | null;
  if (!file || !classroomId) return NextResponse.json({ error: "File dan classroomId wajib" }, { status: 400 });

  const db = getDb();
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(classroomId) as any;
  if (!classroom) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id) {
    return NextResponse.json({ error: "Tidak berhak upload ke kelas ini" }, { status: 403 });
  }

  const maxSizeMb = parseInt((db.prepare("SELECT value FROM system_settings WHERE key='max_file_size_mb'").get() as any)?.value || "50", 10);
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: `File maksimal ${maxSizeMb}MB` }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File kosong" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Ekstensi tidak diizinkan. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` }, { status: 400 });
  }

  // prevent double extension attacks
  const sanitized = sanitizeFilename(path.basename(file.name, ext)) + ext;
  const storedName = `${generateId()}${ext}`;
  const storageDir = path.join(process.cwd(), "storage", "materials", classroomId);
  fs.mkdirSync(storageDir, { recursive: true });
  const storedPath = path.join(storageDir, storedName);

  // protect path traversal
  const resolved = path.resolve(storedPath);
  const base = path.resolve(path.join(process.cwd(), "storage"));
  if (!resolved.startsWith(base)) return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(resolved, buffer);

  const id = generateId();
  const now = nowIso();
  db.prepare(
    "INSERT INTO materials (id, classroom_id, uploaded_by, uploader_name, original_name, stored_name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, classroomId, payload.id, payload.name, file.name, storedName, file.type || "application/octet-stream", file.size, now);

  const material = db.prepare("SELECT * FROM materials WHERE id=?").get(id);
  return NextResponse.json({ ok: true, material });
}
