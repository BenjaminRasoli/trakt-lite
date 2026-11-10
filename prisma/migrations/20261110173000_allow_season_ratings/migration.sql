ALTER TABLE "UserRating"
    DROP CONSTRAINT "UserRating_episode_coordinates_check",
    ADD CONSTRAINT "UserRating_episode_coordinates_check"
        CHECK (
            (
                "seasonNumber" IS NULL
                AND "episodeNumber" IS NULL
                AND "subjectKey" = 'media'
            )
            OR (
                "seasonNumber" IS NOT NULL
                AND "episodeNumber" IS NULL
                AND "seasonNumber" >= 0
                AND "subjectKey" = 'season:' || "seasonNumber"::TEXT
            )
            OR (
                "seasonNumber" IS NOT NULL
                AND "episodeNumber" IS NOT NULL
                AND "seasonNumber" >= 0
                AND "episodeNumber" > 0
                AND "subjectKey" = 'episode:' || "seasonNumber"::TEXT || ':' || "episodeNumber"::TEXT
            )
        );
