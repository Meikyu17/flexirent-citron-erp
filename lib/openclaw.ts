import { z } from "zod";

const isoDate = z.string().datetime();

export const openclawEventSchema = z
  .object({
    source: z.enum(["fleetee_a", "fleetee_b", "getaround", "turo", "other"]),
    vehicleExternalId: z.string().min(1),
    plateNumber: z.string().min(2),
    model: z.string().optional(),
    statusLabel: z.string().optional(),
    locationLabel: z.string().optional(),
    startAt: isoDate,
    endAt: isoDate,
    pickupAt: isoDate,
    dropoffAt: isoDate,
    amountCents: z.number().int().nonnegative(),
    currency: z.string().length(3).default("EUR"),
    customerName: z.string().optional(),
    bookingExternalId: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const openclawPayloadSchema = z
  .object({
    agencyCode: z.enum(["citron-centre", "jean-jaures"]),
    scannedAt: isoDate,
    sentAt: isoDate.optional(),
    requestId: z.string().optional(),
    events: z.array(openclawEventSchema).min(1),
    mode: z.enum(["upsert", "dry-run"]).default("upsert"),
  })
  .passthrough();

export type OpenclawPayload = z.infer<typeof openclawPayloadSchema>;
