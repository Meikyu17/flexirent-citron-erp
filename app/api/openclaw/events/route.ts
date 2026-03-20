import { openclawPayloadSchema } from "@/lib/openclaw";
import { ingestOpenclawPayload } from "@/lib/openclaw-ingestion";

export async function GET() {
  return Response.json({
    ok: true,
    service: "openclaw",
    status: "reachable",
    checkedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const requestId = request.headers.get("x-request-id");
    const idempotencyKey = request.headers.get("idempotency-key");
    const body = await request.json();
    const payload = openclawPayloadSchema.parse(body);

    if (payload.mode === "dry-run") {
      const totalAmount = payload.events.reduce(
        (acc, event) => acc + event.amountCents,
        0,
      );
      return Response.json({
        ok: true,
        mode: "dry-run",
        agencyCode: payload.agencyCode,
        eventsCount: payload.events.length,
        totalAmountCents: totalAmount,
        scannedAt: payload.scannedAt,
      });
    }

    const result = await ingestOpenclawPayload(payload, {
      idempotencyKey,
      requestId,
    });
    return Response.json({
      ok: true,
      mode: "upsert",
      agencyCode: payload.agencyCode,
      eventsCount: payload.events.length,
      totalAmountCents: result.totalAmountCents,
      createdReservations: result.createdReservations,
      updatedReservations: result.updatedReservations,
      skippedAsDuplicate: result.skippedAsDuplicate,
      scannedAt: payload.scannedAt,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Payload Openclaw invalide",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 400 },
    );
  }
}
