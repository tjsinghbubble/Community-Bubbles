import { db } from "./db";
import { bubbles, events } from "@shared/schema";

const LOG = "[migrate-normalize-cover-images]";

function toRelativePath(coverImage: string): string {
  const match = coverImage.match(/(\/objects\/uploads\/[^?#]+)/);
  return match ? match[1] : coverImage;
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function normalizeTable(
  tableName: string,
  rows: Array<{ id: number | string; coverImage: string | null }>,
  updateFn: (id: number | string, path: string) => Promise<void>
): Promise<void> {
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.coverImage) {
      skipped++;
      continue;
    }

    if (!isAbsoluteUrl(row.coverImage)) {
      skipped++;
      continue;
    }

    const relativePath = toRelativePath(row.coverImage);

    if (relativePath === row.coverImage) {
      console.log(`${LOG} [${tableName}] id=${row.id} — could not extract relative path from: ${row.coverImage}`);
      skipped++;
      continue;
    }

    await updateFn(row.id, relativePath);
    console.log(`${LOG} [${tableName}] id=${row.id} → ${relativePath}`);
    updated++;
  }

  console.log(`${LOG} [${tableName}] updated=${updated} skipped=${skipped}`);
}

async function run(): Promise<void> {
  console.log(`${LOG} Starting normalization of cover_image URLs`);

  const allBubbles = await db
    .select({ id: bubbles.id, coverImage: bubbles.coverImage })
    .from(bubbles);

  await normalizeTable("bubbles", allBubbles, async (id, path) => {
    const { eq } = await import("drizzle-orm");
    await db.update(bubbles).set({ coverImage: path }).where(eq(bubbles.id, id as number));
  });

  const allEvents = await db
    .select({ id: events.id, coverImage: events.coverImage })
    .from(events);

  await normalizeTable("events", allEvents, async (id, path) => {
    const { eq } = await import("drizzle-orm");
    await db.update(events).set({ coverImage: path }).where(eq(events.id, id as number));
  });

  console.log(`${LOG} Done`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { run as normalizeCoverImages };
