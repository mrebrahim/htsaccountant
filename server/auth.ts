import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "hts_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

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

export function readCookie(header: string | null, name: string) {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function cookie(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function setSessionCookie(headers: Headers, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, secret(), { expiresIn: MAX_AGE_S });
  headers.append("Set-Cookie", cookie(token, MAX_AGE_S));
}

export function clearSessionCookie(headers: Headers) {
  headers.append("Set-Cookie", cookie("", 0));
}
