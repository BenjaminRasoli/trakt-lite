CREATE TABLE "UserRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserRating"
    ADD CONSTRAINT "UserRating_score_check" CHECK ("score" BETWEEN 1 AND 10);

CREATE UNIQUE INDEX "UserRating_userId_mediaId_key" ON "UserRating"("userId", "mediaId");
CREATE INDEX "UserRating_userId_updatedAt_idx" ON "UserRating"("userId", "updatedAt");

ALTER TABLE "UserRating"
    ADD CONSTRAINT "UserRating_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRating"
    ADD CONSTRAINT "UserRating_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRating" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ratings" ON "UserRating"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "UserRating"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can insert own ratings" ON "UserRating"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "UserRating"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can update own ratings" ON "UserRating"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "UserRating"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can delete own ratings" ON "UserRating"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "UserRating"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );
