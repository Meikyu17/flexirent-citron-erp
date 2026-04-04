import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  deleteTask,
  serializeTask,
  TaskValidationError,
  updateTask,
  validateTaskRelations,
} from "@/lib/tasks";
import { TaskStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      title?: string;
      scheduledAt?: string | null;
      durationMinutes?: number | null;
      notes?: string;
      location?: string;
      assignedToId?: string | null;
      vehicleId?: string | null;
      status?: string;
    };

    const title = body.title?.trim() ?? "";
    if (!title) {
      return Response.json({ ok: false, error: "Le titre est requis." }, { status: 400 });
    }

    const statusValues = Object.values(TaskStatus) as string[];
    const status = statusValues.includes(body.status ?? "")
      ? (body.status as TaskStatus)
      : TaskStatus.TODO;

    const relations = await validateTaskRelations({
      assignedToId: body.assignedToId || null,
      vehicleId: body.vehicleId || null,
    });

    const task = await updateTask(id, {
      title,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      durationMinutes: body.durationMinutes ?? null,
      notes: body.notes?.trim() ?? "",
      location: body.location?.trim() ?? "",
      assignedToId: relations.assignedToId,
      vehicleId: relations.vehicleId,
      status,
    });

    return Response.json({ ok: true, task: serializeTask(task) });
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error(`PATCH /api/tasks/${id} failed`, error);
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
    await deleteTask(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/tasks/${id} failed`, error);
    return Response.json({ ok: false, error: "Erreur lors de la suppression." }, { status: 503 });
  }
}
