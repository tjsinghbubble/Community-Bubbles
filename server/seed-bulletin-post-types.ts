import { db } from "./db";
import { bulletinPostTypes } from "@shared/schema";

const postTypes = [
  { name: "general", displayName: "General", color: "#0EADFF", adminOnly: false, displayOrder: 1 },
  { name: "announcements", displayName: "Announcements", color: "#F9AA2B", adminOnly: true, displayOrder: 2 },
  { name: "help_exchange", displayName: "Help", color: "#34C759", adminOnly: false, displayOrder: 3 },
  { name: "marketplace", displayName: "Marketplace", color: "#FF666B", adminOnly: false, displayOrder: 4 },
];

export async function seedBulletinPostTypes() {
  const existing = await db.select().from(bulletinPostTypes);
  if (existing.length > 0) {
    console.log("[SEED] Bulletin post types already seeded, skipping");
    return;
  }

  for (const pt of postTypes) {
    await db.insert(bulletinPostTypes).values(pt);
  }

  console.log("[SEED] Bulletin post types seeded successfully (4 types)");
}
