import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const lastSuccessfulSync = await prisma.integrationSyncLog.findFirst({
      where: {
        provider: "openclaw",
        status: "SUCCESS",
      },
      orderBy: {
        receivedAt: "desc",
      },
      select: {
        receivedAt: true,
        agencyCode: true,
        recordsCount: true,
      },
    });

    return Response.json({
      ok: true,
      lastScrapeAt: lastSuccessfulSync?.receivedAt.toISOString() ?? null,
      lastAgencyCode: lastSuccessfulSync?.agencyCode ?? null,
      lastRecordsCount: lastSuccessfulSync?.recordsCount ?? null,
    });
  } catch (error) {
    console.error("GET /api/openclaw/status failed", error);
    return Response.json(
      {
        ok: false,
        error:
          "Base de donnees inaccessible. Impossible de recuperer la date du dernier scraping.",
      },
      { status: 503 },
    );
  }
}
