# Trakt Lite

A modern media tracking application built with Next.js that helps you track your favorite movies and TV shows. Features detailed episode tracking, calendar views, and integration with Jellyfin for live session monitoring.

## Demo
Link: [https://TraktLite.vercel.app/](https://traktlite.vercel.app/)

## Features

- **Watch History Tracking**: Track when you watched movies and TV shows with detailed timestamps
- **TV Show Management**: Track individual episodes across seasons with granular watch state
- **Calendar View**: See upcoming episodes from your favorite shows in a calendar format
- **Next Up**: Smart recommendations for what to watch next based on your viewing history
- **Detailed Episode Pages**: View episode details, mark as watched, and manage watch dates
- **Season Management**: Browse episodes by season with watch state indicators
- **Jellyfin Integration**: Live session tracking for what you're currently watching
- **Responsive Design**: Beautiful dark theme UI that works on all devices
- **TMDB Integration**: Rich media data from The Movie Database

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth
- **APIs**: TMDB (The Movie Database), Jellyfin
- **State Management**: React Hooks
- **Routing**: Next.js App Router

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Supabase project (for authentication)
- TMDB API key
- Jellyfin server (optional, for live session tracking)

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd trakt-lite
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trakt_lite"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# TMDB API
NEXT_PUBLIC_TMDB_API_KEY="your-tmdb-api-key"

# Optional: Jellyfin (if using live session tracking)
# JELLYFIN_SERVER_URL="https://your-jellyfin-server.com"
# JELLYFIN_API_KEY="your-jellyfin-api-key"
```

### 4. Database setup

Generate Prisma client and create the database schema:

```bash
npx prisma generate
npx prisma db push
```

Or if you prefer migrations:

```bash
npx prisma migrate dev --name init
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

