-- CreateEnum
CREATE TYPE "DispatchIcalOperationType" AS ENUM ('PICKUP', 'RETURN');

-- CreateTable
CREATE TABLE "DispatchIcalEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchIcalEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchIcalEvent" (
    "id" TEXT NOT NULL,
    "dispatchRef" TEXT NOT NULL,
    "reservationRef" TEXT NOT NULL,
    "missionLabel" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "operationType" "DispatchIcalOperationType" NOT NULL,
    "agencyLabel" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "appointmentLocation" TEXT NOT NULL,
    "appointmentAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchIcalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DispatchIcalEmployee_name_key" ON "DispatchIcalEmployee"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchIcalEmployee_slug_key" ON "DispatchIcalEmployee"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchIcalEmployee_token_key" ON "DispatchIcalEmployee"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchIcalEvent_employeeId_dispatchRef_key" ON "DispatchIcalEvent"("employeeId", "dispatchRef");

-- CreateIndex
CREATE INDEX "DispatchIcalEvent_employeeId_appointmentAt_idx" ON "DispatchIcalEvent"("employeeId", "appointmentAt");

-- AddForeignKey
ALTER TABLE "DispatchIcalEvent" ADD CONSTRAINT "DispatchIcalEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "DispatchIcalEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
