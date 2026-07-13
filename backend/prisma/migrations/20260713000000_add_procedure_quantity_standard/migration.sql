-- AlterTable: Add standard to Procedure
ALTER TABLE "Procedure" ADD COLUMN IF NOT EXISTS "standard" TEXT;

-- AlterTable: Add quantity and note to ProcedureLog
ALTER TABLE "ProcedureLog" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProcedureLog" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- CreateIndex: userId and procedureId for faster filtering (Ф-23/24)
CREATE INDEX IF NOT EXISTS "ProcedureLog_userId_idx" ON "ProcedureLog"("userId");
CREATE INDEX IF NOT EXISTS "ProcedureLog_procedureId_idx" ON "ProcedureLog"("procedureId");
