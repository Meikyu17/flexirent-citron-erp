import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgencyBrand, CustomerType } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  type: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  agencyBrand: z.nativeEnum(AgencyBrand).nullable().optional(),
  licenseAgeDays: z.number().int().positive().nullable().optional(),
});

export async function GET(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { lastName: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        _count: { select: { statusLogs: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
    });

    return Response.json({
      ok: true,
      customers: customers.map((c) => ({
        id: c.id,
        type: c.type,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        agencyBrand: c.agencyBrand,
        licenseAgeDays: c.licenseAgeDays,
        reservationCount: c._count.statusLogs,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/clients failed", error);
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

  const d = parsed.data;
  try {
    const customer = await prisma.customer.create({
      data: {
        type: d.type,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        agencyBrand: d.agencyBrand ?? null,
        licenseAgeDays: d.licenseAgeDays ?? null,
      },
    });

    return Response.json(
      {
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
          reservationCount: 0,
          createdAt: customer.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/clients failed", error);
    return Response.json({ ok: false, error: "Impossible de créer le client." }, { status: 503 });
  }
}
