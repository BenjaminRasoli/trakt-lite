-- Add supabaseUserId column to User table (nullable initially for migration)
ALTER TABLE "User" ADD COLUMN "supabaseUserId" TEXT;

-- Migrate existing users: populate supabaseUserId from Supabase Auth
-- This query matches users by email between the database and Supabase Auth
-- Note: This requires access to Supabase Auth metadata, which may need to be done via the app

-- Enable RLS on User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- User policies: users can only read/update their own record
-- Also allow access via email for backward compatibility during migration
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (
    auth.uid()::text = "supabaseUserId" OR
    auth.email() = email
  );

CREATE POLICY "Users can update own profile" ON "User"
  FOR UPDATE USING (
    auth.uid()::text = "supabaseUserId" OR
    auth.email() = email
  );

CREATE POLICY "Users can insert own profile" ON "User"
  FOR INSERT WITH CHECK (auth.uid()::text = "supabaseUserId");

-- Enable RLS on JellyfinConnection table
ALTER TABLE "JellyfinConnection" ENABLE ROW LEVEL SECURITY;

-- JellyfinConnection policies: users can only manage their own connection
-- Need to join with User table to check supabaseUserId or email
CREATE POLICY "Users can view own connection" ON "JellyfinConnection"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "JellyfinConnection"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can update own connection" ON "JellyfinConnection"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "JellyfinConnection"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can insert own connection" ON "JellyfinConnection"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "JellyfinConnection"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can delete own connection" ON "JellyfinConnection"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "JellyfinConnection"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

-- Enable RLS on WatchHistory table
ALTER TABLE "WatchHistory" ENABLE ROW LEVEL SECURITY;

-- WatchHistory policies: users can only manage their own history
CREATE POLICY "Users can view own history" ON "WatchHistory"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "WatchHistory"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can insert own history" ON "WatchHistory"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "WatchHistory"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can update own history" ON "WatchHistory"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "WatchHistory"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can delete own history" ON "WatchHistory"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "WatchHistory"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

-- Enable RLS on Watchlist table
ALTER TABLE "Watchlist" ENABLE ROW LEVEL SECURITY;

-- Watchlist policies: users can only manage their own watchlist
CREATE POLICY "Users can view own watchlist" ON "Watchlist"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "Watchlist"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can insert own watchlist" ON "Watchlist"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "Watchlist"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can update own watchlist" ON "Watchlist"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "Watchlist"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

CREATE POLICY "Users can delete own watchlist" ON "Watchlist"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = "Watchlist"."userId"
      AND ("User"."supabaseUserId" = auth.uid()::text OR "User"."email" = auth.email())
    )
  );

-- Enable RLS on Media table
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;

-- Media policies: allow public read access (it's a shared catalog)
CREATE POLICY "Public can view media" ON "Media"
  FOR SELECT USING (true);

-- No insert/update/delete policies for Media - should be managed via API/backend
