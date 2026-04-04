-- CreateTable
CREATE TABLE "UserPasswordOverride" (
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPasswordOverride_pkey" PRIMARY KEY ("email")
);
