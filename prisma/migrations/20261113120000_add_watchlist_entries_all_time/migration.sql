CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchlistEntry_userId_mediaId_key" ON "WatchlistEntry"("userId", "mediaId");

ALTER TABLE "WatchlistEntry"
ADD CONSTRAINT "WatchlistEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchlistEntry"
ADD CONSTRAINT "WatchlistEntry_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "Media"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WatchlistEntry" ("id", "userId", "mediaId", "createdAt")
SELECT gen_random_uuid()::text, "userId", "mediaId", "createdAt"
FROM "Watchlist"
ON CONFLICT ("userId", "mediaId") DO NOTHING;

ALTER TABLE "WatchlistEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlist entries"
ON "WatchlistEntry"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = "WatchlistEntry"."userId"
        AND (
            "User"."supabaseUserId" = auth.uid()::text
            OR "User"."email" = auth.email()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = "WatchlistEntry"."userId"
        AND (
            "User"."supabaseUserId" = auth.uid()::text
            OR "User"."email" = auth.email()
        )
    )
);
