-- CreateEnum
CREATE TYPE "ParkingOptionKind" AS ENUM ('AREA', 'SPOT');

-- CreateTable
CREATE TABLE "ParkingOption" (
    "id" TEXT NOT NULL,
    "kind" "ParkingOptionKind" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingOption_kind_value_key" ON "ParkingOption"("kind", "value");
