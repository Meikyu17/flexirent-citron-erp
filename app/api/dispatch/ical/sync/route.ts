import {
  forbiddenResponse,
  getAuthUserFromCookie,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  buildDispatchIcalEvent,
  createIcalFeedToken,
  slugifyEmployeeName,
  type DispatchIcalEventPayload,
} from "@/lib/dispatch-ical";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bookingSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(8),
  type: z.enum(["PICKUP", "RETURN"]),
  client: z.string().min(1),
  pickup: z.string().min(1),
  dropoff: z.string().min(1),
  dropoffDate: z.string().min(8),
  car: z.string().min(1),
  plateNumber: z.string().min(1),
  amount: z.number(),
  source: z.enum(["Fleetee A", "Fleetee B", "Getaround", "Turo"]),
  agency: z.enum(["CITRON_LOCATION", "FLEXIRENT"]),
});

const dispatchItemSchema = z.object({
  id: z.string().min(1),
  bookingRef: z.string().min(1),
  mission: z.string().min(1),
  members: z.array(z.string().trim().min(1)).default([]),
  state: z.enum(["À assigner", "Assigné"]),
});

const syncPayloadSchema = z.object({
  operators: z.array(z.string().trim().min(1)).default([]),
  bookings: z.array(bookingSchema).default([]),
  dispatchItems: z.array(dispatchItemSchema).default([]),
});

type EmployeeRecord = {
  id: string;
  name: string;
  slug: string;
  token: string;
  email: string | null;
};

function normalizeName(rawName: string) {
  return rawName.trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) {
    return unauthorizedResponse();
  }
  if (user.role !== "MANAGER" && user.role !== "OPERATOR") {
    return forbiddenResponse("Acces reserve a l'equipe dispatch");
  }

  try {
    const body = await request.json();
    const payload = syncPayloadSchema.parse(body);
    const bookingByRef = new Map(payload.bookings.map((booking) => [booking.id, booking]));

    const employeeNames = new Set<string>();
    for (const operatorName of payload.operators) {
      employeeNames.add(normalizeName(operatorName));
    }

    const eventsByEmployee = new Map<string, Map<string, DispatchIcalEventPayload>>();

    for (const dispatchItem of payload.dispatchItems) {
      const booking = bookingByRef.get(dispatchItem.bookingRef);
      if (!booking) {
        continue;
      }

      const eventPayload = buildDispatchIcalEvent(dispatchItem, booking);
      if (!eventPayload) {
        continue;
      }

      const assignedMember =
        dispatchItem.members
          .map((rawName) => normalizeName(rawName))
          .find((memberName) => Boolean(memberName)) ?? null;

      if (!assignedMember) {
        continue;
      }

      employeeNames.add(assignedMember);

      if (!eventsByEmployee.has(assignedMember)) {
        eventsByEmployee.set(assignedMember, new Map());
      }
      eventsByEmployee.get(assignedMember)?.set(dispatchItem.id, eventPayload);
    }

    for (const employeeName of employeeNames) {
      if (!eventsByEmployee.has(employeeName)) {
        eventsByEmployee.set(employeeName, new Map());
      }
    }

    const sortedEmployeeNames = [...employeeNames].sort((a, b) => a.localeCompare(b, "fr"));
    const origin = new URL(request.url).origin;

    const result = await prisma.$transaction(async (tx) => {
      const employeeByName = new Map<string, EmployeeRecord>();

      for (const employeeName of sortedEmployeeNames) {
        const employee = await tx.dispatchIcalEmployee.upsert({
          where: { name: employeeName },
          create: {
            name: employeeName,
            slug: slugifyEmployeeName(employeeName),
            token: createIcalFeedToken(),
          },
          update: {
            slug: slugifyEmployeeName(employeeName),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            token: true,
            email: true,
          },
        });
        employeeByName.set(employeeName, employee);
      }

      let syncedEvents = 0;

      for (const employeeName of sortedEmployeeNames) {
        const employee = employeeByName.get(employeeName);
        if (!employee) {
          continue;
        }

        const eventEntries = [...(eventsByEmployee.get(employeeName)?.values() ?? [])];
        const dispatchRefs = eventEntries.map((event) => event.dispatchRef);

        for (const event of eventEntries) {
          await tx.dispatchIcalEvent.upsert({
            where: {
              employeeId_dispatchRef: {
                employeeId: employee.id,
                dispatchRef: event.dispatchRef,
              },
            },
            create: {
              employeeId: employee.id,
              dispatchRef: event.dispatchRef,
              reservationRef: event.reservationRef,
              missionLabel: event.missionLabel,
              customerName: event.customerName,
              operationType: event.operationType,
              agencyLabel: event.agencyLabel,
              sourceLabel: event.sourceLabel,
              vehicleModel: event.vehicleModel,
              plateNumber: event.plateNumber,
              appointmentLocation: event.appointmentLocation,
              appointmentAt: event.appointmentAt,
              endsAt: event.endsAt,
              notes: event.notes,
            },
            update: {
              reservationRef: event.reservationRef,
              missionLabel: event.missionLabel,
              customerName: event.customerName,
              operationType: event.operationType,
              agencyLabel: event.agencyLabel,
              sourceLabel: event.sourceLabel,
              vehicleModel: event.vehicleModel,
              plateNumber: event.plateNumber,
              appointmentLocation: event.appointmentLocation,
              appointmentAt: event.appointmentAt,
              endsAt: event.endsAt,
              notes: event.notes,
            },
          });
          syncedEvents += 1;
        }

        if (dispatchRefs.length === 0) {
          await tx.dispatchIcalEvent.deleteMany({
            where: { employeeId: employee.id },
          });
        } else {
          await tx.dispatchIcalEvent.deleteMany({
            where: {
              employeeId: employee.id,
              dispatchRef: { notIn: dispatchRefs },
            },
          });
        }
      }

      const eventCounts = await tx.dispatchIcalEvent.groupBy({
        by: ["employeeId"],
        _count: {
          _all: true,
        },
      });
      const countByEmployeeId = new Map(
        eventCounts.map((item) => [item.employeeId, item._count._all]),
      );

      const feeds = sortedEmployeeNames
        .map((employeeName) => employeeByName.get(employeeName))
        .filter((employee): employee is EmployeeRecord => Boolean(employee))
        .map((employee) => ({
          name: employee.name,
          email: employee.email,
          eventCount: countByEmployeeId.get(employee.id) ?? 0,
          feedUrl: `${origin}/api/dispatch/ical?token=${employee.token}`,
        }));

      return {
        syncedEvents,
        feeds,
      };
    });

    return Response.json({
      ok: true,
      employees: sortedEmployeeNames.length,
      syncedEvents: result.syncedEvents,
      feeds: result.feeds,
    });
  } catch (error) {
    console.error("POST /api/dispatch/ical/sync failed", error);
    return Response.json(
      {
        ok: false,
        error:
          "Synchronisation iCal impossible. Verifiez que PostgreSQL est lance et que les migrations Prisma sont appliquees.",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 400 },
    );
  }
}
