-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "expectedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "expectedReadyAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");
