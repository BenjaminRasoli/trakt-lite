ALTER TABLE "UserRating"
    ADD COLUMN "subjectKey" TEXT NOT NULL DEFAULT 'media',
    ADD COLUMN "seasonNumber" INTEGER,
    ADD COLUMN "episodeNumber" INTEGER;

DROP INDEX "UserRating_userId_mediaId_key";
CREATE UNIQUE INDEX "UserRating_userId_mediaId_subjectKey_key"
    ON "UserRating"("userId", "mediaId", "subjectKey");

ALTER TABLE "UserRating"
    DROP CONSTRAINT "UserRating_score_check",
    ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::DOUBLE PRECISION,
    ADD CONSTRAINT "UserRating_score_check"
        CHECK ("score" BETWEEN 0.5 AND 10 AND "score" * 10 = trunc("score" * 10)),
    ADD CONSTRAINT "UserRating_episode_coordinates_check"
        CHECK (
            ("seasonNumber" IS NULL AND "episodeNumber" IS NULL AND "subjectKey" = 'media')
            OR (
                "seasonNumber" IS NOT NULL
                AND "episodeNumber" IS NOT NULL
                AND
                "seasonNumber" >= 0
                AND "episodeNumber" > 0
                AND "subjectKey" = 'episode:' || "seasonNumber"::TEXT || ':' || "episodeNumber"::TEXT
            )
        );
