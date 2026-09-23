-- A globally unique idempotency key lets one user burn a key another user is
-- about to present. Scope it to the wallet that owns the transaction.

-- DropIndex
DROP INDEX "Transaction_idempotencyKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_walletId_idempotencyKey_key" ON "Transaction"("walletId", "idempotencyKey");
