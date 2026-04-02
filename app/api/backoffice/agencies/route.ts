import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { listAgencies } from "@/lib/backoffice";

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const agencies = await listAgencies();
    return Response.json({
      ok: true,
      agencies: agencies.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        brand: a.brand,
        brandLabel: brandLabels[a.brand],
      })),
    });
  } catch (error) {
    console.error("GET /api/backoffice/agencies failed", error);
    return Response.json(
      { ok: false, error: "Base de donnees inaccessible." },
      { status: 503 },
    );
  }
}
