import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    await prisma.savedAddress.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/backoffice/addresses/${id} failed`, error);
    return Response.json({ ok: false, error: "Adresse introuvable." }, { status: 404 });
  }
}
