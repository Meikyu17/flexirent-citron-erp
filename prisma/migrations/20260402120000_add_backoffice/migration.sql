-- Add isCleaned field to Vehicle
ALTER TABLE "Vehicle" ADD COLUMN "isCleaned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable VehicleStatusLog
CREATE TABLE "VehicleStatusLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "VehicleOperationalStatus" NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "agencyBrand" "AgencyBrand" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleStatusLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VehicleStatusLog" ADD CONSTRAINT "VehicleStatusLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
