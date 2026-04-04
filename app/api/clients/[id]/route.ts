import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgencyBrand, CustomerType } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  type: z.nativeEnum(CustomerType).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  agencyBrand: z.nativeEnum(AgencyBrand).nullable().optional(),
  licenseAgeDays: z.number().int().positive().nullable().optional(),
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
    return Response.json(
      { ok: false, error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const d = parsed.data;
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(d.type !== undefined && { type: d.type }),
        ...(d.firstName !== undefined && { firstName: d.firstName }),
        ...(d.lastName !== undefined && { lastName: d.lastName }),
        ...(d.email !== undefined && { email: d.email || null }),
        ...(d.phone !== undefined && { phone: d.phone || null }),
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.agencyBrand !== undefined && { agencyBrand: d.agencyBrand }),
        ...(d.licenseAgeDays !== undefined && { licenseAgeDays: d.licenseAgeDays }),
      },
      include: { _count: { select: { statusLogs: true } } },
    });

    return Response.json({
      ok: true,
      customer: {
        id: customer.id,
        type: customer.type,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        agencyBrand: customer.agencyBrand,
        licenseAgeDays: customer.licenseAgeDays,
        reservationCount: customer._count.statusLogs,
        createdAt: customer.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/clients/[id] failed", error);
    return Response.json({ ok: false, error: "Impossible de modifier le client." }, { status: 503 });
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
    await prisma.customer.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id] failed", error);
    return Response.json({ ok: false, error: "Impossible de supprimer le client." }, { status: 503 });
  }
}
