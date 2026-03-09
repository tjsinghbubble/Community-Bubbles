import { eq } from "drizzle-orm";
import { db } from "./db";
import { appConfig } from "@shared/schema";

const defaults = [
  { key: "max_bubble_photos", value: "20" },
];

export async function seedAppConfig() {
  for (const config of defaults) {
    const existing = await db.select().from(appConfig).where(
      eq(appConfig.key, config.key)
    );
    if (existing.length === 0) {
      await db.insert(appConfig).values(config);
      console.log(`[SEED] App config '${config.key}' set to '${config.value}'`);
    }
  }
}
