import { db } from "./db";
import { categories } from "@shared/schema";
import { count } from "drizzle-orm";

export async function seedCategories() {
  const result = await db.select({ count: count() }).from(categories);
  if (result[0].count > 0) return;

  const topLevel = [
    { name: "Sports & Fitness", icon: "sports" },
    { name: "Food & Drink", icon: "food" },
    { name: "Social", icon: "social" },
    { name: "Creative", icon: "creative" },
    { name: "Outdoors", icon: "outdoors" },
    { name: "Wellness", icon: "wellness" },
    { name: "Professional", icon: "professional" },
    { name: "Pets & Animals", icon: "pets" },
    { name: "Community", icon: "community" },
  ];

  for (const cat of topLevel) {
    const [parent] = await db.insert(categories).values({ name: cat.name, icon: cat.icon, parentId: null }).returning();

    const subs = getSubcategories(cat.name);
    for (const sub of subs) {
      await db.insert(categories).values({ name: sub.name, icon: sub.icon, parentId: parent.id });
    }
  }

  console.log("[SEED] Categories seeded successfully");
}

function getSubcategories(parentName: string): { name: string; icon: string | null }[] {
  switch (parentName) {
    case "Sports & Fitness":
      return [
        { name: "Running", icon: "running" },
        { name: "Tennis", icon: "tennis" },
        { name: "Biking", icon: "biking" },
        { name: "Yoga", icon: "yoga" },
        { name: "Basketball", icon: "basketball" },
        { name: "Soccer", icon: "soccer" },
        { name: "Swimming", icon: "swimming" },
        { name: "Gym & Weightlifting", icon: "gym" },
      ];
    case "Food & Drink":
      return [
        { name: "Cooking", icon: "cooking" },
        { name: "Coffee Meets", icon: "coffee" },
        { name: "Wine Tasting", icon: "wine" },
        { name: "Baking", icon: "baking" },
        { name: "Food Trucks", icon: "foodtruck" },
      ];
    case "Social":
      return [
        { name: "Book Club", icon: "book" },
        { name: "Game Night", icon: "game" },
        { name: "Movie Night", icon: "movie" },
        { name: "Language Exchange", icon: "language" },
      ];
    case "Creative":
      return [
        { name: "Arts & Crafts", icon: "arts" },
        { name: "Photography", icon: "photography" },
        { name: "Music", icon: "music" },
        { name: "Writing", icon: "writing" },
        { name: "Dance", icon: "dance" },
      ];
    case "Outdoors":
      return [
        { name: "Hiking", icon: "hiking" },
        { name: "Gardening", icon: "gardening" },
        { name: "Camping", icon: "camping" },
        { name: "Fishing", icon: "fishing" },
        { name: "Bird Watching", icon: "birdwatching" },
      ];
    case "Wellness":
      return [
        { name: "Meditation", icon: "meditation" },
        { name: "Mental Health", icon: "mentalhealth" },
        { name: "Nutrition", icon: "nutrition" },
        { name: "Self Care", icon: "selfcare" },
      ];
    case "Professional":
      return [
        { name: "Networking", icon: "networking" },
        { name: "Startups", icon: "startup" },
        { name: "Tech", icon: "tech" },
        { name: "Career Growth", icon: "career" },
      ];
    case "Pets & Animals":
      return [
        { name: "Dogs", icon: "dogs" },
        { name: "Cats", icon: "cats" },
        { name: "Exotic Pets", icon: "exotic" },
      ];
    case "Community":
      return [
        { name: "Volunteering", icon: "volunteer" },
        { name: "Local Events", icon: "localevents" },
        { name: "Neighborhood", icon: "neighborhood" },
        { name: "Parents", icon: "parents" },
      ];
    default:
      return [];
  }
}
