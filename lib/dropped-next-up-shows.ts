import { prisma } from "@/lib/prisma";

let droppedNextUpTableExists: boolean | undefined;

export function isMissingDroppedNextUpTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2021"
  );
}

export async function getDroppedNextUpShows(userId: string): Promise<{
  tmdbIds: Set<number>;
  available: boolean;
}> {
  if (droppedNextUpTableExists === false) {
    return { tmdbIds: new Set(), available: false };
  }

  try {
    const droppedShows = await prisma.droppedNextUpShow.findMany({
      where: { userId },
      select: { tmdbId: true },
    });
    droppedNextUpTableExists = true;
    return {
      tmdbIds: new Set(droppedShows.map((show) => show.tmdbId)),
      available: true,
    };
  } catch (error) {
    if (!isMissingDroppedNextUpTable(error)) throw error;

    droppedNextUpTableExists = false;
    console.warn(
      "Dropped Next Up shows are unavailable because the database migration has not been applied.",
    );
    return { tmdbIds: new Set(), available: false };
  }
}
