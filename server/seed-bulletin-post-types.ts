import { db } from "./db";
import { bulletinPostTypes } from "@shared/schema";

const postTypes = [
  { name: "general", displayName: "General", color: "#4CAF50", adminOnly: false, displayOrder: 1 },
  { name: "announcements", displayName: "Announcements", color: "#FF9800", adminOnly: true, displayOrder: 2 },
  { name: "help_exchange", displayName: "Help & Exchange", color: "#2196F3", adminOnly: false, displayOrder: 3 },
  { name: "marketplace", displayName: "Marketplace", color: "#E91E63", adminOnly: false, displayOrder: 4 },
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
