-- AlterTable
ALTER TABLE "DispatchIcalEvent" ADD COLUMN     "customerPhone" TEXT;

-- AlterTable
ALTER TABLE "VehicleStatusLog" ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "returnAddress" TEXT;

-- CreateTable
CREATE TABLE "SavedAddress" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_label_key" ON "SavedAddress"("label");
