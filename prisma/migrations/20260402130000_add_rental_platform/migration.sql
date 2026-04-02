-- CreateEnum
CREATE TYPE "RentalPlatform" AS ENUM ('GETAROUND', 'FLEETEE', 'TURO', 'DIRECT');

-- AlterTable
ALTER TABLE "VehicleStatusLog" ADD COLUMN "platform" "RentalPlatform";
