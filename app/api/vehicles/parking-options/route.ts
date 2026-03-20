import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  addParkingOption,
  deleteParkingOption,
  getParkingOptions,
} from "@/lib/vehicles";
import { z } from "zod";

const optionSchema = z.object({
  kind: z.enum(["AREA", "SPOT"]),
  value: z.string().trim().min(1).max(80),
});

export async function GET() {
  const user = await getAuthUserFromCookie();

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const options = await getParkingOptions();

    return Response.json({ ok: true, areas: options.areas, spots: options.spots });
  } catch (error) {
    console.error("GET /api/vehicles/parking-options failed", error);

    return Response.json(
      { ok: false, error: "Erreur serveur" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();

  if (!user) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = optionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ ok: false, error: "Donnees invalides" }, { status: 400 });
  }

  try {
    await addParkingOption(parsed.data.kind, parsed.data.value);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("POST /api/vehicles/parking-options failed", error);

    return Response.json({ ok: false, error: "Erreur serveur" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAuthUserFromCookie();

  if (!user) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = optionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ ok: false, error: "Donnees invalides" }, { status: 400 });
  }

  try {
    await deleteParkingOption(parsed.data.kind, parsed.data.value);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/parking-options failed", error);

    return Response.json({ ok: false, error: "Erreur serveur" }, { status: 503 });
  }
}
