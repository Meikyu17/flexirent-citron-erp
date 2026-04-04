import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { createTask, listTasks, serializeTask } from "@/lib/tasks";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const tasks = await listTasks();
    return Response.json({ ok: true, tasks: tasks.map(serializeTask) });
  } catch (error) {
    console.error("GET /api/tasks failed", error);
    return Response.json({ ok: false, error: "Base de données inaccessible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      title?: string;
      scheduledAt?: string | null;
      durationMinutes?: number | null;
      notes?: string;
      location?: string;
      assignedToId?: string | null;
      vehicleId?: string | null;
    };

    const title = body.title?.trim() ?? "";
    if (!title) {
      return Response.json({ ok: false, error: "Le titre est requis." }, { status: 400 });
    }

    const task = await createTask({
      title,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      durationMinutes: body.durationMinutes ?? null,
      notes: body.notes?.trim() ?? "",
      location: body.location?.trim() ?? "",
      assignedToId: body.assignedToId || null,
      vehicleId: body.vehicleId || null,
    });

    return Response.json({ ok: true, task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks failed", error);
    return Response.json({ ok: false, error: "Erreur lors de la création." }, { status: 503 });
  }
}
