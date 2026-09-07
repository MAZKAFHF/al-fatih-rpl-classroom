import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME_CONST } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");
  if (!classroomId) return NextResponse.json({ error: "classroomId required" }, { status: 400 });
  const db = getDb();
  const materials = db.prepare("SELECT * FROM materials WHERE classroom_id=? ORDER BY created_at DESC").all(classroomId);
  return NextResponse.json({ materials });
}
