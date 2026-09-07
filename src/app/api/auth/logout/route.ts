import { NextResponse } from "next/server";
import { COOKIE_NAME_CONST } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME_CONST, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
