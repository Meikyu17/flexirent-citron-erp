import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { createAgency, listAgencies } from "@/lib/backoffice";

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

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      name?: string;
      code?: string;
      city?: string;
      brand?: string;
    };

    const name = body.name?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const brand = body.brand;

    if (!name || !code || !city) {
      return Response.json(
        { ok: false, error: "Nom, code et ville sont requis." },
        { status: 400 },
      );
    }

    if (brand !== "CITRON_LOCATION" && brand !== "FLEXIRENT") {
      return Response.json(
        { ok: false, error: "Marque invalide." },
        { status: 400 },
      );
    }

    const agency = await createAgency({ name, code, city, brand });
    return Response.json({
      ok: true,
      agency: {
        id: agency.id,
        code: agency.code,
        name: agency.name,
        brand: agency.brand,
        brandLabel: brandLabels[agency.brand],
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return Response.json(
        { ok: false, error: "Ce code agence est déjà utilisé." },
        { status: 409 },
      );
    }
    console.error("POST /api/backoffice/agencies failed", error);
    return Response.json(
      { ok: false, error: "Erreur lors de la création de l'agence." },
      { status: 503 },
    );
  }
}
