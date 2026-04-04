import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { setDispatchAssignment } from "@/lib/dispatch";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const body = (await request.json()) as { operatorId: string | null; operatorName?: string | null };

  // Status-log-based missions — persist the operator name on the log record
  if (id.startsWith("log-")) {
    const logId = id.slice(4);
    const operatorName = body.operatorName ?? null;
    try {
      await prisma.vehicleStatusLog.update({
        where: { id: logId },
        data: { assignedOperatorName: operatorName },
      });
      return Response.json({ ok: true });
    } catch (error) {
      console.error(`PATCH /api/dispatch/items/${id} (log) failed`, error);
      return Response.json({ ok: false, error: "Impossible de mettre à jour l'assignation." }, { status: 503 });
    }
  }

  const operatorId = body.operatorId?.startsWith("ical-") ? null : (body.operatorId ?? null);

  try {
    await setDispatchAssignment(id, operatorId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`PATCH /api/dispatch/items/${id} failed`, error);
    return Response.json(
      { ok: false, error: "Impossible de mettre à jour l'assignation." },
      { status: 503 },
    );
  }
}
