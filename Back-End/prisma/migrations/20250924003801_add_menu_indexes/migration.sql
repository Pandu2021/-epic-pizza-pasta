-- CreateIndex
CREATE INDEX "MenuItem_category_idx" ON "MenuItem"("category");

-- CreateIndex
CREATE INDEX "MenuItem_updatedAt_idx" ON "MenuItem"("updatedAt");

-- CreateIndex
CREATE INDEX "MenuItem_category_updatedAt_idx" ON "MenuItem"("category", "updatedAt");
