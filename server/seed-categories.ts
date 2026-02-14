import { db } from "./db";
import { categories } from "@shared/schema";
import { count } from "drizzle-orm";

export async function seedCategories() {
  const result = await db.select({ count: count() }).from(categories);
  if (result[0].count > 0) return;

  const allCategories = [
    { name: "Running", icon: "running" },
    { name: "Cooking", icon: "cooking" },
    { name: "Coffee Meets", icon: "coffee" },
    { name: "Professional", icon: "professional" },
    { name: "Hiking", icon: "hiking" },
    { name: "Tennis", icon: "tennis" },
    { name: "Biking", icon: "biking" },
    { name: "Pets", icon: "pets" },
    { name: "Arts & Crafts", icon: "arts" },
    { name: "Community", icon: "community" },
    { name: "Gardening", icon: "gardening" },
    { name: "Food & Drink", icon: "food" },
    { name: "Wellness", icon: "wellness" },
    { name: "Yoga", icon: "yoga" },
  ];

  for (const cat of allCategories) {
    await db.insert(categories).values({ name: cat.name, icon: cat.icon, parentId: null });
  }

  console.log("[SEED] Categories seeded successfully");
}
