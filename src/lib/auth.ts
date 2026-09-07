import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "al-fatih-rpl-local-secret-change-in-production-32chars";
const COOKIE_NAME = "rpl_session";
const JWT_EXPIRES = "7d";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT" | "GUEST";

export interface SessionPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  guest?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest | Request): string | null {
  // try cookie header
  const cookieHeader = (req as NextRequest).headers?.get?.("cookie") || (req as Request).headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: false, // local network http
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export const COOKIE_NAME_CONST = COOKIE_NAME;
export const JWT_SECRET_CONST = JWT_SECRET;
