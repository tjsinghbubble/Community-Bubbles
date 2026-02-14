import { db } from "./db";
import { categories } from "@shared/schema";
import { count, eq, isNull } from "drizzle-orm";

export async function seedCategories() {
  const result = await db.select({ count: count() }).from(categories);
  const isEmpty = result[0].count === 0;

  const allCategories = [
    {
      name: "Running", icon: "running", image: "/images/categories/running.jpg",
      placeholderName: "e.g., Morning Mile Crew",
      placeholderTagline: "e.g., Lace up and hit the road together",
      placeholderDescription: "e.g., A group for runners of all levels who want to train, share routes, and stay motivated together.",
    },
    {
      name: "Cooking", icon: "cooking", image: "/images/categories/cooking.jpg",
      placeholderName: "e.g., Home Chef Collective",
      placeholderTagline: "e.g., Cook, share, and savor together",
      placeholderDescription: "e.g., Swap recipes, host cook-alongs, and explore cuisines from around the world with fellow foodies.",
    },
    {
      name: "Coffee Meets", icon: "coffee", image: "/images/categories/coffee.jpg",
      placeholderName: "e.g., Morning Brew Club",
      placeholderTagline: "e.g., Connecting over great coffee",
      placeholderDescription: "e.g., Casual meetups at local cafés to chat, network, and discover the best brews in town.",
    },
    {
      name: "Professional", icon: "professional", image: "/images/categories/professional.jpg",
      placeholderName: "e.g., Career Connect Hub",
      placeholderTagline: "e.g., Grow your network, grow your career",
      placeholderDescription: "e.g., A space for professionals to share advice, find mentors, and explore new opportunities together.",
    },
    {
      name: "Hiking", icon: "hiking", image: "/images/categories/hiking.jpg",
      placeholderName: "e.g., Trail Blazers",
      placeholderTagline: "e.g., Explore trails and make friends",
      placeholderDescription: "e.g., Weekend hikes, trail recommendations, and outdoor adventures for nature lovers of every skill level.",
    },
    {
      name: "Tennis", icon: "tennis", image: "/images/categories/tennis.jpg",
      placeholderName: "e.g., Local Racket Club",
      placeholderTagline: "e.g., Find your doubles partner",
      placeholderDescription: "e.g., Casual rallies, friendly matches, and skill-building sessions for tennis enthusiasts nearby.",
    },
    {
      name: "Biking", icon: "biking", image: "/images/categories/biking.jpg",
      placeholderName: "e.g., Pedal Pals",
      placeholderTagline: "e.g., Ride together, go further",
      placeholderDescription: "e.g., Group rides, route sharing, and bike maintenance tips for cyclists in the neighborhood.",
    },
    {
      name: "Pets", icon: "pets", image: "/images/categories/pets.jpg",
      placeholderName: "e.g., Paws & Friends",
      placeholderTagline: "e.g., Playdates for pets and their humans",
      placeholderDescription: "e.g., Connect with local pet owners for walks, playdates, pet-sitting swaps, and adorable photo shares.",
    },
    {
      name: "Arts & Crafts", icon: "arts", image: "/images/categories/arts-crafts.jpg",
      placeholderName: "e.g., Creative Corner",
      placeholderTagline: "e.g., Make something beautiful together",
      placeholderDescription: "e.g., Share your creations, join craft nights, and learn new techniques with fellow artists and makers.",
    },
    {
      name: "Community", icon: "community", image: "/images/categories/community.jpg",
      placeholderName: "e.g., Neighborhood Circle",
      placeholderTagline: "e.g., Bringing neighbors closer together",
      placeholderDescription: "e.g., A hub for local events, volunteering, and getting to know the people around you.",
    },
    {
      name: "Gardening", icon: "gardening", image: "/images/categories/gardening.jpg",
      placeholderName: "e.g., Green Thumb Gang",
      placeholderTagline: "e.g., Grow together, bloom together",
      placeholderDescription: "e.g., Tips, plant swaps, and garden tours for anyone who loves getting their hands in the dirt.",
    },
    {
      name: "Food & Drink", icon: "food", image: "/images/categories/food-drink.jpg",
      placeholderName: "e.g., Flavor Explorers",
      placeholderTagline: "e.g., Taste the best spots in town",
      placeholderDescription: "e.g., Restaurant reviews, food crawls, and tasting events for anyone who loves discovering new flavors.",
    },
    {
      name: "Wellness", icon: "wellness", image: "/images/categories/wellness.jpg",
      placeholderName: "e.g., Mindful Living Circle",
      placeholderTagline: "e.g., Nurture your mind, body, and soul",
      placeholderDescription: "e.g., Meditation sessions, wellness challenges, and self-care tips to help you feel your best.",
    },
    {
      name: "Yoga", icon: "yoga", image: "/images/categories/yoga.jpg",
      placeholderName: "e.g., Flow Together",
      placeholderTagline: "e.g., Stretch, breathe, and find your balance",
      placeholderDescription: "e.g., Group yoga sessions, pose tutorials, and mindfulness practices for yogis of all levels.",
    },
  ];

  if (isEmpty) {
    for (const cat of allCategories) {
      await db.insert(categories).values({
        name: cat.name,
        icon: cat.icon,
        image: cat.image,
        parentId: null,
        placeholderName: cat.placeholderName,
        placeholderTagline: cat.placeholderTagline,
        placeholderDescription: cat.placeholderDescription,
      });
    }
    console.log("[SEED] Categories seeded successfully");
  } else {
    for (const cat of allCategories) {
      await db.update(categories)
        .set({
          placeholderName: cat.placeholderName,
          placeholderTagline: cat.placeholderTagline,
          placeholderDescription: cat.placeholderDescription,
          image: cat.image,
        })
        .where(eq(categories.name, cat.name));
    }
    console.log("[SEED] Categories placeholders backfilled");
  }
}
