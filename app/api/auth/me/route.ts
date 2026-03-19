import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();
  return Response.json({ ok: true, user });
}
