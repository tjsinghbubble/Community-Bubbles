import { db } from "./db";
import { categoryPlaceholders, categories } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface PlaceholderSet {
  categoryName: string;
  name: string;
  tagline: string;
  description: string;
}

const placeholderData: PlaceholderSet[] = [
  // Food & Social
  {
    categoryName: "dining_out",
    name: "Flavor Explorers",
    tagline: "Taste the best spots in town",
    description: "Restaurant reviews, food crawls, and tasting events for anyone who loves discovering new flavors.",
  },
  {
    categoryName: "coffee_meetups",
    name: "Morning Brew Club",
    tagline: "Connecting over great coffee",
    description: "Casual meetups at local cafés to chat, network, and discover the best brews in town.",
  },
  {
    categoryName: "brunch",
    name: "Sunday Brunch Bunch",
    tagline: "The best meal of the week",
    description: "Weekend brunch outings to discover the best mimosas, pancakes, and vibes in the area.",
  },
  {
    categoryName: "farmers_market",
    name: "Market Wanderers",
    tagline: "Shop local, eat fresh",
    description: "Explore local farmers markets together, share finds, and support local growers and artisans.",
  },
  {
    categoryName: "wine_and_spirits",
    name: "Pour & Savor",
    tagline: "Sip, swirl, and socialize",
    description: "Wine tastings, brewery tours, and cocktail nights for enthusiasts of fine beverages.",
  },
  // Active
  {
    categoryName: "fitness_classes",
    name: "FitFam Local",
    tagline: "Sweat it out together",
    description: "Join group fitness classes, bootcamps, and workout sessions with neighbors who love staying active.",
  },
  {
    categoryName: "pickleball",
    name: "Pickle Posse",
    tagline: "Dink, drive, and have fun",
    description: "Casual and competitive pickleball games for players of all levels in your area.",
  },
  {
    categoryName: "hiking",
    name: "Trail Blazers",
    tagline: "Explore trails and make friends",
    description: "Weekend hikes, trail recommendations, and outdoor adventures for nature lovers of every skill level.",
  },
  {
    categoryName: "running",
    name: "Morning Mile Crew",
    tagline: "Lace up and hit the road together",
    description: "A group for runners of all levels who want to train, share routes, and stay motivated together.",
  },
  {
    categoryName: "team_sports",
    name: "Weekend Warriors",
    tagline: "Play together, win together",
    description: "Organize pickup games, leagues, and scrimmages for basketball, soccer, volleyball and more.",
  },
  {
    categoryName: "cycling",
    name: "Pedal Pals",
    tagline: "Ride together, go further",
    description: "Group rides, route sharing, and bike maintenance tips for cyclists in the neighborhood.",
  },
  {
    categoryName: "yoga",
    name: "Flow Together",
    tagline: "Stretch, breathe, and find your balance",
    description: "Group yoga sessions, pose tutorials, and mindfulness practices for yogis of all levels.",
  },
  {
    categoryName: "dance",
    name: "Rhythm & Moves",
    tagline: "Dance like nobody's watching",
    description: "Salsa, hip-hop, ballroom or freestyle — find your groove with fellow dance lovers nearby.",
  },
  {
    categoryName: "tennis",
    name: "Local Racket Club",
    tagline: "Find your doubles partner",
    description: "Casual rallies, friendly matches, and skill-building sessions for tennis enthusiasts nearby.",
  },
  // Creative
  {
    categoryName: "cooking",
    name: "Home Chef Collective",
    tagline: "Cook, share, and savor together",
    description: "Swap recipes, host cook-alongs, and explore cuisines from around the world with fellow foodies.",
  },
  {
    categoryName: "board_games",
    name: "Game Night Gang",
    tagline: "Roll the dice and have fun",
    description: "Regular game nights with board games, card games, and tabletop RPGs for all experience levels.",
  },
  {
    categoryName: "arts_and_crafts",
    name: "Creative Corner",
    tagline: "Make something beautiful together",
    description: "Share your creations, join craft nights, and learn new techniques with fellow artists and makers.",
  },
  {
    categoryName: "book_clubs",
    name: "Page Turners",
    tagline: "Read, discuss, repeat",
    description: "Monthly book picks, lively discussions, and literary adventures with fellow readers nearby.",
  },
  {
    categoryName: "photography",
    name: "Shutter Squad",
    tagline: "Capture the moment together",
    description: "Photo walks, editing tips, and portfolio sharing for photographers at every level.",
  },
  {
    categoryName: "music",
    name: "Jam Session Crew",
    tagline: "Make music, make friends",
    description: "Jam sessions, open mics, and music appreciation meetups for musicians and music lovers.",
  },
  // Lifestyle
  {
    categoryName: "gardening",
    name: "Green Thumb Gang",
    tagline: "Grow together, bloom together",
    description: "Tips, plant swaps, and garden tours for anyone who loves getting their hands in the dirt.",
  },
  {
    categoryName: "dog_pet_groups",
    name: "Paws & Friends",
    tagline: "Playdates for pets and their humans",
    description: "Connect with local pet owners for walks, playdates, pet-sitting swaps, and adorable photo shares.",
  },
  {
    categoryName: "family_circles",
    name: "Parent Connect",
    tagline: "Raising kids together",
    description: "A supportive space for parents and caregivers to share tips, arrange playdates, and build community.",
  },
  {
    categoryName: "wellness",
    name: "Mindful Living Circle",
    tagline: "Nurture your mind, body, and soul",
    description: "Meditation sessions, wellness challenges, and self-care tips to help you feel your best.",
  },
  // Adventure & Outdoors
  {
    categoryName: "travel_and_exploration",
    name: "Wanderlust Club",
    tagline: "Explore new places together",
    description: "Group trips, travel tips, and exploration meetups for adventurers who love discovering new destinations.",
  },
  {
    categoryName: "beach_and_water",
    name: "Shore Squad",
    tagline: "Life's better by the water",
    description: "Beach days, surfing, kayaking, and water activities with fellow ocean and lake lovers.",
  },
  {
    categoryName: "camping_and_backpacking",
    name: "Basecamp Crew",
    tagline: "Sleep under the stars",
    description: "Plan camping trips, share gear recommendations, and explore the great outdoors together.",
  },
  // Community
  {
    categoryName: "volunteering_and_nonprofit",
    name: "Give Back Group",
    tagline: "Make a difference together",
    description: "Organize volunteer events, support local causes, and connect with others who want to give back.",
  },
  {
    categoryName: "neighborhood_groups",
    name: "Neighborhood Circle",
    tagline: "Bringing neighbors closer together",
    description: "A hub for local events, safety updates, recommendations, and getting to know the people around you.",
  },
  // Tech & Professional
  {
    categoryName: "professional_networking",
    name: "Career Connect Hub",
    tagline: "Grow your network, grow your career",
    description: "A space for professionals to share advice, find mentors, and explore new opportunities together.",
  },
  {
    categoryName: "coworking_and_work_buddies",
    name: "Work Together Crew",
    tagline: "Productive company nearby",
    description: "Find coworking partners, share workspace recommendations, and stay motivated working alongside others.",
  },
  {
    categoryName: "tech_meetups",
    name: "Local Dev Collective",
    tagline: "Code, learn, and connect",
    description: "Tech talks, hackathons, and coding sessions for developers and tech enthusiasts in the area.",
  },
  {
    categoryName: "startup_and_founders",
    name: "Founders Circle",
    tagline: "Build something great together",
    description: "Connect with fellow founders, share startup journeys, and find co-founders and collaborators.",
  },
  // Campus
  {
    categoryName: "campus_events",
    name: "Campus Happenings",
    tagline: "Never miss a campus event",
    description: "Stay updated on campus events, concerts, lectures, and social gatherings at your university.",
  },
  {
    categoryName: "clubs",
    name: "Campus Club Hub",
    tagline: "Find your people on campus",
    description: "Discover and join student clubs, organizations, and interest groups at your university.",
  },
  {
    categoryName: "study_groups",
    name: "Study Squad",
    tagline: "Learn better together",
    description: "Form study groups for classes, share notes, and prepare for exams with fellow students.",
  },
  {
    categoryName: "intramural_sports",
    name: "Campus Athletes",
    tagline: "Compete and have fun",
    description: "Join intramural teams, find practice partners, and compete in campus sports leagues.",
  },
  {
    categoryName: "greek_life",
    name: "Greek Connect",
    tagline: "Brotherhood and sisterhood",
    description: "Connect with members of fraternities and sororities, plan events, and build lifelong bonds.",
  },
];

export async function seedCategoryPlaceholders() {
  const allCategories = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));

  const existingCount = await db.select({ id: categoryPlaceholders.id }).from(categoryPlaceholders).limit(1);
  if (existingCount.length > 0) {
    console.log("[SEED] Category placeholders already seeded, skipping.");
    return;
  }

  let inserted = 0;
  for (const p of placeholderData) {
    const categoryId = categoryMap.get(p.categoryName);
    if (!categoryId) {
      console.warn(`[SEED] Category not found: ${p.categoryName}`);
      continue;
    }
    await db.insert(categoryPlaceholders).values([
      { categoryId, fieldType: "name", value: p.name, displayOrder: 0 },
      { categoryId, fieldType: "tagline", value: p.tagline, displayOrder: 0 },
      { categoryId, fieldType: "description", value: p.description, displayOrder: 0 },
    ]);
    inserted += 3;
  }

  console.log(`[SEED] Category placeholders seeded: ${inserted} rows`);
}
