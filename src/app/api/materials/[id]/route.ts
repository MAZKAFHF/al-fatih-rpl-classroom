import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb } from "@/lib/db";
import path from "path";
import fs from "fs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const material = db.prepare("SELECT * FROM materials WHERE id=?").get(id) as any;
  if (!material) return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404 });

  const filePath = path.join(process.cwd(), "storage", "materials", material.classroom_id, material.stored_name);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File tidak ditemukan di server" }, { status: 404 });

  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": material.mime_type,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(material.original_name)}"`,
      "Content-Length": String(buf.length),
    },
  });
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
  const material = db.prepare("SELECT * FROM materials WHERE id=?").get(id) as any;
  if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // check ownership for teacher
  const classroom = db.prepare("SELECT * FROM classrooms WHERE id=?").get(material.classroom_id) as any;
  if (payload.role === "TEACHER" && classroom.created_by !== payload.id && material.uploaded_by !== payload.id) {
    return NextResponse.json({ error: "Tidak berhak menghapus" }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "storage", "materials", material.classroom_id, material.stored_name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
  db.prepare("DELETE FROM materials WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
