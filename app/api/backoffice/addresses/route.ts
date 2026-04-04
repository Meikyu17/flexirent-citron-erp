import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const addresses = await prisma.savedAddress.findMany({
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    });
    return Response.json({ ok: true, addresses });
  } catch (error) {
    console.error("GET /api/backoffice/addresses failed", error);
    return Response.json({ ok: false, error: "Erreur base de données." }, { status: 503 });
  }
}
