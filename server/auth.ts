import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Response } from "express";

export const SESSION_COOKIE = "hts_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (at least 16 characters)");
  return s;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function readSession(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, secret()) as { sub: string };
    return { userId: Number(payload.sub) };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, secret(), { expiresIn: MAX_AGE_MS / 1000 });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
