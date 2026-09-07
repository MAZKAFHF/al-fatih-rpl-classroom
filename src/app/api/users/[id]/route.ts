import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(COOKIE_NAME_CONST)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (payload.id === id) return NextResponse.json({ error: "Tidak dapat menghapus diri sendiri" }, { status: 400 });
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id) as any;
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
