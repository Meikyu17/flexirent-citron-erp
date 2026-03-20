import {
  forbiddenResponse,
  getAuthUserFromCookie,
  unauthorizedResponse,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) {
    return unauthorizedResponse();
  }
  if (user.role !== "MANAGER" && user.role !== "OPERATOR") {
    return forbiddenResponse("Acces reserve a l'equipe dispatch");
  }

  try {
    const origin = new URL(request.url).origin;
    const employees = await prisma.dispatchIcalEmployee.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
        events: {
          select: {
            updatedAt: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
    });

    return Response.json({
      ok: true,
      feeds: employees.map((employee) => ({
        name: employee.name,
        email: employee.email,
        eventCount: employee._count.events,
        updatedAt: employee.events[0]?.updatedAt.toISOString() ?? null,
        feedUrl: `${origin}/api/dispatch/ical?token=${employee.token}`,
      })),
    });
  } catch (error) {
    console.error("GET /api/dispatch/ical/feeds failed", error);
    return Response.json(
      {
        ok: false,
        error:
          "Impossible de recuperer les liens iCal. Verifiez la connexion a PostgreSQL.",
      },
      { status: 503 },
    );
  }
}
