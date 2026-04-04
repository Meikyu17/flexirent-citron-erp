import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  vehicleModel: z.string().trim().min(1).max(100).optional(),
  dailyRate: z.number().int().positive().optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Données invalides" }, { status: 400 });
  }

  try {
    const d = parsed.data;
    const rate = await prisma.pricingRate.update({
      where: { id },
      data: {
        ...(d.vehicleModel !== undefined && { vehicleModel: d.vehicleModel }),
        ...(d.dailyRate !== undefined && { dailyRate: d.dailyRate }),
        ...(d.notes !== undefined && { notes: d.notes || null }),
      },
    });
    return Response.json({ ok: true, rate: { id: rate.id, agencyBrand: rate.agencyBrand, vehicleModel: rate.vehicleModel, dailyRate: rate.dailyRate, notes: rate.notes, updatedAt: rate.updatedAt.toISOString() } });
  } catch (error) {
    console.error("PATCH /api/pricing/[id] failed", error);
    return Response.json({ ok: false, error: "Impossible de modifier le tarif." }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  try {
    await prisma.pricingRate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/pricing/[id] failed", error);
    return Response.json({ ok: false, error: "Impossible de supprimer le tarif." }, { status: 503 });
  }
}
