import {
  forbiddenResponse,
  getAuthUserFromCookie,
  unauthorizedResponse,
} from "@/lib/auth";
import { buildIcalDescription, operationLabel } from "@/lib/dispatch-ical";
import { generateDispatchIcs, generateDispatchScheduleIcs } from "@/lib/ical";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const dispatchIcalSchema = z.object({
  dispatchId: z.string().min(1),
  reservationId: z.string().min(1),
  title: z.string().min(5),
  description: z.string().min(5),
  location: z.string().min(2),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  attendees: z.array(z.string().email()).min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return Response.json(
      { ok: false, error: "Token iCal manquant" },
      { status: 400 },
    );
  }

  try {
    const employee = await prisma.dispatchIcalEmployee.findUnique({
      where: { token },
      include: {
        events: {
          orderBy: [
            { appointmentAt: "asc" },
            { updatedAt: "desc" },
          ],
        },
      },
    });

    if (!employee) {
      return Response.json(
        { ok: false, error: "Flux iCal introuvable" },
        { status: 404 },
      );
    }

    const ics = generateDispatchScheduleIcs({
      calendarName: `Dispatch ${employee.name}`,
      events: employee.events.map((event) => ({
        uid: `${event.dispatchRef}-${employee.slug}@citron-erp`,
        title: event.customerPhone
          ? `${operationLabel(event.operationType)} · ${event.customerName} · ${event.customerPhone}`
          : `${operationLabel(event.operationType)} · ${event.customerName}`,
        description: buildIcalDescription({
          reservationRef: event.reservationRef,
          missionLabel: event.missionLabel,
          customerName: event.customerName,
          customerPhone: event.customerPhone,
          operationType: event.operationType,
          vehicleModel: event.vehicleModel,
          plateNumber: event.plateNumber,
          appointmentLocation: event.appointmentLocation,
          appointmentAt: event.appointmentAt,
          agencyLabel: event.agencyLabel,
          sourceLabel: event.sourceLabel,
          notes: event.notes,
        }),
        location: event.appointmentLocation,
        startAtIso: event.appointmentAt.toISOString(),
        endAtIso: event.endsAt.toISOString(),
      })),
    });

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="dispatch-${employee.slug}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/dispatch/ical failed", error);
    return Response.json(
      {
        ok: false,
        error:
          "Generation du flux iCal impossible. Verifiez la connexion a PostgreSQL.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();
  if (user.role !== "MANAGER") {
    return forbiddenResponse("Seul un gestionnaire peut generer le dispatch iCal");
  }

  try {
    const body = await request.json();
    const payload = dispatchIcalSchema.parse(body);

    const ics = generateDispatchIcs({
      uid: `${payload.dispatchId}@citron-erp`,
      title: payload.title,
      description: payload.description,
      location: payload.location,
      startAtIso: payload.startAt,
      endAtIso: payload.endAt,
      attendees: payload.attendees,
    });

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="dispatch-${payload.dispatchId}.ics"`,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Payload iCal invalide",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 400 },
    );
  }
}
