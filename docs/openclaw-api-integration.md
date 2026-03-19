# Openclaw -> Citron ERP: specification API

Ce document definit le contrat d'integration pour les envois Openclaw vers Citron ERP.

## Objectif

Permettre a Openclaw de pousser des snapshots de reservations/vehicules vers Citron ERP, plusieurs fois par jour, avec:

- validation stricte
- deduplication (idempotence)
- mode test sans ecriture (`dry-run`)
- traçabilite complete des synchronisations

## Endpoint principal

- **URL recommandee**: `POST /api/v1/openclaw/events`
- **URL legacy compatible**: `POST /api/openclaw/events`
- **Content-Type**: `application/json`

## Authentification API (version actuelle)

Pour le moment, l'endpoint Openclaw est ouvert a l'interieur du perimetre applicatif (pas de JWT utilisateur requis), afin de faciliter les premiers tests d'integration.

Recommandation production immediate:

1. Ajouter un token technique (`x-api-key`) cote Openclaw
2. Whitelister les IP de sortie Openclaw
3. Signer le body avec HMAC (`x-signature`)

## Headers recommandes

- `Content-Type: application/json`
- `X-Request-Id: <uuid>` (trace technique)
- `Idempotency-Key: <string-unique-par-lot>` (anti-doublon)

`Idempotency-Key` est fortement recommande: si la meme cle est renvoyee, Citron ERP n'applique pas de doublon metier.

## Payload JSON (contrat v1)

```json
{
  "agencyCode": "citron-centre",
  "scannedAt": "2026-03-19T08:30:00.000Z",
  "sentAt": "2026-03-19T08:30:03.000Z",
  "requestId": "7fc95e0d-95d4-4d5a-845f-5113adf4f766",
  "mode": "upsert",
  "events": [
    {
      "source": "fleetee_a",
      "vehicleExternalId": "veh_445",
      "plateNumber": "YF-284-GK",
      "model": "Peugeot 206",
      "statusLabel": "Reserve",
      "locationLabel": "Emplacement 14",
      "startAt": "2026-03-19T09:00:00.000Z",
      "endAt": "2026-03-19T17:00:00.000Z",
      "pickupAt": "2026-03-19T08:45:00.000Z",
      "dropoffAt": "2026-03-19T17:15:00.000Z",
      "amountCents": 13200,
      "currency": "EUR",
      "customerName": "Dominique D.",
      "bookingExternalId": "R-2191",
      "metadata": {
        "driver_phone": "+33600000000",
        "source_url": "https://fleetee.example.com/bookings/R-2191"
      }
    }
  ]
}
```

## Regles de validation

### Champs racine

- `agencyCode` (obligatoire): `"citron-centre"` ou `"jean-jaures"`
- `scannedAt` (obligatoire): ISO 8601 datetime UTC
- `sentAt` (optionnel): ISO 8601 datetime UTC
- `requestId` (optionnel): identifiant trace fourni par Openclaw
- `mode` (optionnel): `"upsert"` (defaut) ou `"dry-run"`
- `events` (obligatoire): tableau non vide

### Champs event

- `source` (obligatoire): `fleetee_a | fleetee_b | getaround | turo | other`
- `vehicleExternalId` (obligatoire): identifiant stable vehicule cote source
- `plateNumber` (obligatoire): immatriculation
- `bookingExternalId` (obligatoire): identifiant reservation stable cote source
- `startAt`, `endAt`, `pickupAt`, `dropoffAt` (obligatoires): ISO 8601
- `amountCents` (obligatoire): entier >= 0
- `currency` (optionnel, defaut EUR): code ISO 4217 sur 3 caracteres
- `customerName`, `model`, `statusLabel`, `locationLabel` (optionnels)
- `metadata` (optionnel): dictionnaire libre pour champs non standards
- Champs inconnus: acceptes (payload tolerant)

## Modes d'execution

### `mode = "dry-run"`

- Validation complete
- Aucune ecriture en base
- Reponse avec resume calcule (events + montant)

### `mode = "upsert"` (defaut)

- Upsert agence
- Upsert vehicule (par `vehicleExternalId`)
- Upsert reservation (par `bookingExternalId`)
- Journalisation dans `IntegrationSyncLog`

## Semantique d'upsert

Si un `bookingExternalId` existe deja:

- la reservation est **mise a jour**
- la reponse incremente `updatedReservations`

Sinon:

- la reservation est **cree**
- la reponse incremente `createdReservations`

## Reponses API

### 200 OK (upsert)

```json
{
  "ok": true,
  "mode": "upsert",
  "agencyCode": "citron-centre",
  "eventsCount": 2,
  "totalAmountCents": 22600,
  "createdReservations": 1,
  "updatedReservations": 1,
  "skippedAsDuplicate": false,
  "scannedAt": "2026-03-19T08:30:00.000Z"
}
```

### 200 OK (doublon idempotent)

```json
{
  "ok": true,
  "mode": "upsert",
  "agencyCode": "citron-centre",
  "eventsCount": 2,
  "totalAmountCents": 0,
  "createdReservations": 0,
  "updatedReservations": 0,
  "skippedAsDuplicate": true,
  "scannedAt": "2026-03-19T08:30:00.000Z"
}
```

### 200 OK (`dry-run`)

```json
{
  "ok": true,
  "mode": "dry-run",
  "agencyCode": "citron-centre",
  "eventsCount": 2,
  "totalAmountCents": 22600,
  "scannedAt": "2026-03-19T08:30:00.000Z"
}
```

### 400 Bad Request

```json
{
  "ok": false,
  "error": "Payload Openclaw invalide",
  "details": "..."
}
```

## Politique de retry cote Openclaw

1. Si HTTP `>=500` ou timeout: retry exponentiel (1s, 2s, 5s, 10s, 30s)
2. Si HTTP `429`: respecter `Retry-After` si present
3. Si HTTP `400`: ne pas retry sans corriger le payload
4. Toujours renvoyer la meme `Idempotency-Key` pour un meme lot logique

## Exemple cURL (production)

```bash
curl -X POST "https://ton-domaine.com/api/v1/openclaw/events" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: 7fc95e0d-95d4-4d5a-845f-5113adf4f766" \
  -H "Idempotency-Key: openclaw-2026-03-19T08:30:00Z-citron-centre" \
  -d '{
    "agencyCode":"citron-centre",
    "scannedAt":"2026-03-19T08:30:00.000Z",
    "mode":"upsert",
    "events":[
      {
        "source":"fleetee_a",
        "vehicleExternalId":"veh_445",
        "plateNumber":"YF-284-GK",
        "startAt":"2026-03-19T09:00:00.000Z",
        "endAt":"2026-03-19T17:00:00.000Z",
        "pickupAt":"2026-03-19T08:45:00.000Z",
        "dropoffAt":"2026-03-19T17:15:00.000Z",
        "amountCents":13200,
        "currency":"EUR",
        "bookingExternalId":"R-2191"
      }
    ]
  }'
```

## Dispatch iCal (manager)

Endpoint: `POST /api/dispatch/ical`

Usage:

- reserve aux gestionnaires connectes
- retourne un fichier `.ics` telechargeable
- peut etre envoye ensuite par email/SMS via ton workflow

Payload:

```json
{
  "dispatchId": "D-11",
  "reservationId": "R-2191",
  "title": "Remise de cle - Citroen C3",
  "description": "Mission de remise pour Dominique D.",
  "location": "Jean-Jaures",
  "startAt": "2026-03-19T15:30:00.000Z",
  "endAt": "2026-03-19T16:00:00.000Z",
  "attendees": ["nathan@citron.fr", "louise@citron.fr"]
}
```
