import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyEmployeeName, createIcalFeedToken } from "@/lib/dispatch-ical";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const members = await prisma.dispatchIcalEmployee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, isAvailableForDispatch: true, updatedAt: true },
    });
    return Response.json({ ok: true, members });
  } catch (error) {
    console.error("GET /api/backoffice/team failed", error);
    return Response.json({ ok: false, error: "Base de données inaccessible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as { name?: string; email?: string };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() || null;

    if (!name) {
      return Response.json({ ok: false, error: "Le nom est requis." }, { status: 400 });
    }

    const member = await prisma.dispatchIcalEmployee.create({
      data: {
        name,
        slug: slugifyEmployeeName(name),
        token: createIcalFeedToken(),
        email,
        isAvailableForDispatch: true,
      },
      select: { id: true, name: true, email: true, isAvailableForDispatch: true, updatedAt: true },
    });

    return Response.json({ ok: true, member }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return Response.json({ ok: false, error: "Ce nom est déjà utilisé." }, { status: 409 });
    }
    console.error("POST /api/backoffice/team failed", error);
    return Response.json({ ok: false, error: "Erreur lors de la création." }, { status: 503 });
  }
}
