-- CreateEnum
CREATE TYPE "AdPosition" AS ENUM ('LEFT', 'RIGHT', 'POPUP');

-- CreateEnum
CREATE TYPE "AdFrequency" AS ENUM ('EVERY_PAGE', 'SESSION', 'DAILY');

-- CreateTable
CREATE TABLE "Ad" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" "AdPosition" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "linkUrl" TEXT,
    "openNewTab" BOOLEAN NOT NULL DEFAULT true,
    "homeOnly" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "AdFrequency" NOT NULL DEFAULT 'SESSION',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_position_isActive_order_idx" ON "Ad"("position", "isActive", "order");

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

