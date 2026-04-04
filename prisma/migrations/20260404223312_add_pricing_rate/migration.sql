-- CreateTable
CREATE TABLE "PricingRate" (
    "id" TEXT NOT NULL,
    "agencyBrand" "AgencyBrand" NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "dailyRate" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingRate_agencyBrand_vehicleModel_key" ON "PricingRate"("agencyBrand", "vehicleModel");
