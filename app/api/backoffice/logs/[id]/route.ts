import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { deleteStatusLog } from "@/lib/backoffice";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  try {
    await deleteStatusLog(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/backoffice/logs/${id} failed`, error);
    return Response.json(
      { ok: false, error: "Impossible de supprimer la reservation." },
      { status: 503 },
    );
  }
}
