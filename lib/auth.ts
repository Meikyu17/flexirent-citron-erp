import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type AuthRole = "MANAGER" | "OPERATOR";

export type AuthUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  agencyCode: "citron-centre" | "jean-jaures";
};

type TokenPayload = AuthUser & { type: "access" };

const COOKIE_NAME = "citron_auth";
const tokenSecret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "citron-dev-secret-change-me",
);

const users: Array<AuthUser & { password: string }> = [
  {
    email: process.env.CITRON_MANAGER_EMAIL ?? "manager@citron-erp.local",
    password: process.env.CITRON_MANAGER_PASSWORD ?? "ChangeMeManager123!",
    firstName: "Nathan",
    lastName: "Manager",
    role: "MANAGER",
    agencyCode: "citron-centre",
  },
  {
    email: process.env.CITRON_OPERATOR_EMAIL ?? "operateur@citron-erp.local",
    password: process.env.CITRON_OPERATOR_PASSWORD ?? "ChangeMeOperator123!",
    firstName: "Louise",
    lastName: "Operateur",
    role: "OPERATOR",
    agencyCode: "jean-jaures",
  },
];

export async function loginWithCredentials(email: string, password: string) {
  const user = users.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.toLowerCase().trim() &&
      candidate.password === password,
  );
  if (!user) {
    return null;
  }
  const safeUser = {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    agencyCode: user.agencyCode,
  };
  return safeUser;
}

export async function createAccessToken(user: AuthUser) {
  const token = await new SignJWT({ ...user, type: "access" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(tokenSecret);
  return token;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthUserFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, tokenSecret);
    if (payload.type !== "access") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function unauthorizedResponse(message = "Non autorise") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Acces refuse") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}
