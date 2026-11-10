CREATE TABLE "DroppedNextUpShow" (
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DroppedNextUpShow_pkey" PRIMARY KEY ("userId", "tmdbId")
);

ALTER TABLE "DroppedNextUpShow"
ADD CONSTRAINT "DroppedNextUpShow_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DroppedNextUpShow" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dropped Next Up shows"
ON "DroppedNextUpShow"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = "DroppedNextUpShow"."userId"
        AND (
            "User"."supabaseUserId" = auth.uid()::text
            OR "User"."email" = auth.email()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = "DroppedNextUpShow"."userId"
        AND (
            "User"."supabaseUserId" = auth.uid()::text
            OR "User"."email" = auth.email()
        )
    )
);
