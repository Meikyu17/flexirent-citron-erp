import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgencyBrand } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  agencyBrand: z.nativeEnum(AgencyBrand),
  vehicleModel: z.string().trim().min(1).max(100),
  dailyRate: z.number().int().positive(), // centimes
  notes: z.string().trim().max(300).optional(),
});

export async function GET(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const rates = await prisma.pricingRate.findMany({
      orderBy: [{ agencyBrand: "asc" }, { vehicleModel: "asc" }],
    });
    return Response.json({
      ok: true,
      rates: rates.map((r) => ({
        id: r.id,
        agencyBrand: r.agencyBrand,
        vehicleModel: r.vehicleModel,
        dailyRate: r.dailyRate,
        notes: r.notes,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/pricing failed", error);
    return Response.json({ ok: false, error: "Base de données inaccessible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const d = parsed.data;
    const rate = await prisma.pricingRate.upsert({
      where: { agencyBrand_vehicleModel: { agencyBrand: d.agencyBrand, vehicleModel: d.vehicleModel } },
      create: { agencyBrand: d.agencyBrand, vehicleModel: d.vehicleModel, dailyRate: d.dailyRate, notes: d.notes || null },
      update: { dailyRate: d.dailyRate, notes: d.notes || null },
    });
    return Response.json(
      { ok: true, rate: { id: rate.id, agencyBrand: rate.agencyBrand, vehicleModel: rate.vehicleModel, dailyRate: rate.dailyRate, notes: rate.notes, updatedAt: rate.updatedAt.toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/pricing failed", error);
    return Response.json({ ok: false, error: "Impossible d'enregistrer le tarif." }, { status: 503 });
  }
}
