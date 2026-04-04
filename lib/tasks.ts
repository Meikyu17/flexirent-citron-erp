import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const taskInclude = {
  assignedTo: { select: { id: true, name: true } },
  vehicle: { select: { id: true, model: true, plateNumber: true } },
} as const;

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

export async function validateTaskRelations(data: {
  assignedToId: string | null;
  vehicleId: string | null;
}) {
  const assignedToId = data.assignedToId?.startsWith("ical-")
    ? data.assignedToId.slice(5)
    : data.assignedToId;

  if (assignedToId) {
    const assignee = await prisma.dispatchIcalEmployee.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });

    if (!assignee) {
      throw new TaskValidationError("Le membre sélectionné est invalide.");
    }
  }

  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true },
    });

    if (!vehicle) {
      throw new TaskValidationError("Le véhicule sélectionné est invalide.");
    }
  }

  return {
    assignedToId: assignedToId ?? null,
    vehicleId: data.vehicleId ?? null,
  };
}

export async function listTasks(filter?: { status?: TaskStatus }) {
  return prisma.task.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    include: taskInclude,
  });
}

export async function createTask(data: {
  title: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  notes: string;
  location: string;
  assignedToId: string | null;
  vehicleId: string | null;
}) {
  return prisma.task.create({
    data: {
      title: data.title,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      notes: data.notes || null,
      location: data.location || null,
      assignedToId: data.assignedToId,
      vehicleId: data.vehicleId,
      status: TaskStatus.TODO,
    },
    include: taskInclude,
  });
}

export async function updateTask(
  id: string,
  data: {
    title: string;
    scheduledAt: Date | null;
    durationMinutes: number | null;
    notes: string;
    location: string;
    assignedToId: string | null;
    vehicleId: string | null;
    status: TaskStatus;
  },
) {
  return prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      notes: data.notes || null,
      location: data.location || null,
      assignedToId: data.assignedToId,
      vehicleId: data.vehicleId,
      status: data.status,
    },
    include: taskInclude,
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

export function serializeTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    location: row.location,
    status: row.status as string,
    assignedTo: row.assignedTo
      ? { id: row.assignedTo.id, name: row.assignedTo.name }
      : null,
    vehicle: row.vehicle
      ? { id: row.vehicle.id, model: row.vehicle.model, plateNumber: row.vehicle.plateNumber }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}
