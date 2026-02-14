import { db } from "./db";
import { categories } from "@shared/schema";
import { count } from "drizzle-orm";

export async function seedCategories() {
  const result = await db.select({ count: count() }).from(categories);
  if (result[0].count > 0) return;

  const allCategories = [
    { name: "Running", icon: "running", image: "/images/categories/running.jpg" },
    { name: "Cooking", icon: "cooking", image: "/images/categories/cooking.jpg" },
    { name: "Coffee Meets", icon: "coffee", image: "/images/categories/coffee.jpg" },
    { name: "Professional", icon: "professional", image: "/images/categories/professional.jpg" },
    { name: "Hiking", icon: "hiking", image: "/images/categories/hiking.jpg" },
    { name: "Tennis", icon: "tennis", image: "/images/categories/tennis.jpg" },
    { name: "Biking", icon: "biking", image: "/images/categories/biking.jpg" },
    { name: "Pets", icon: "pets", image: "/images/categories/pets.jpg" },
    { name: "Arts & Crafts", icon: "arts", image: "/images/categories/arts-crafts.jpg" },
    { name: "Community", icon: "community", image: "/images/categories/community.jpg" },
    { name: "Gardening", icon: "gardening", image: "/images/categories/gardening.jpg" },
    { name: "Food & Drink", icon: "food", image: "/images/categories/food-drink.jpg" },
    { name: "Wellness", icon: "wellness", image: "/images/categories/wellness.jpg" },
    { name: "Yoga", icon: "yoga", image: "/images/categories/yoga.jpg" },
  ];

  for (const cat of allCategories) {
    await db.insert(categories).values({ name: cat.name, icon: cat.icon, image: cat.image, parentId: null });
  }

  console.log("[SEED] Categories seeded successfully");
}
