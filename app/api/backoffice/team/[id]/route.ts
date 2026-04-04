import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyEmployeeName } from "@/lib/dispatch-ical";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = (await request.json()) as { name?: string; email?: string; isAvailableForDispatch?: boolean };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() || null;

    if (!name) {
      return Response.json({ ok: false, error: "Le nom est requis." }, { status: 400 });
    }

    const member = await prisma.dispatchIcalEmployee.update({
      where: { id },
      data: {
        name,
        slug: slugifyEmployeeName(name),
        email,
        ...(body.isAvailableForDispatch !== undefined && { isAvailableForDispatch: body.isAvailableForDispatch }),
      },
      select: { id: true, name: true, email: true, isAvailableForDispatch: true, updatedAt: true },
    });

    return Response.json({ ok: true, member });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return Response.json({ ok: false, error: "Ce nom est déjà utilisé." }, { status: 409 });
    }
    console.error(`PATCH /api/backoffice/team/${id} failed`, error);
    return Response.json({ ok: false, error: "Erreur lors de la modification." }, { status: 503 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    await prisma.dispatchIcalEmployee.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/backoffice/team/${id} failed`, error);
    return Response.json({ ok: false, error: "Erreur lors de la suppression." }, { status: 503 });
  }
}
