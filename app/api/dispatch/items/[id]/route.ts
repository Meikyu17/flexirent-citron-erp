import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { setDispatchAssignment } from "@/lib/dispatch";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  // Status-log-based missions et opérateurs iCal n'ont pas de Dispatch en DB
  if (id.startsWith("log-")) {
    return Response.json({ ok: true });
  }

  const body = (await request.json()) as { operatorId: string | null };
  const operatorId =
    body.operatorId?.startsWith("ical-") ? null : (body.operatorId ?? null);

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
