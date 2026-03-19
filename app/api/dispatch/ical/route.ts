import {
  forbiddenResponse,
  getAuthUserFromCookie,
  unauthorizedResponse,
} from "@/lib/auth";
import { generateDispatchIcs } from "@/lib/ical";
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
