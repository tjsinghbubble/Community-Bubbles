import { db } from "./db";
import { categories } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SubCategory {
  name: string;
  displayName: string;
  icon: string;
  image?: string;
  placeholderName: string;
  placeholderTagline: string;
  placeholderDescription: string;
}

interface ParentCategory {
  name: string;
  displayName: string;
  icon: string;
  children: SubCategory[];
}

const categoryTree: ParentCategory[] = [
  {
    name: "active", displayName: "Active", icon: "fitness",
    children: [
      { name: "hiking", displayName: "Hiking", icon: "walk", image: "/images/categories/hiking.jpg", placeholderName: "e.g., Trail Blazers", placeholderTagline: "e.g., Explore trails and make friends", placeholderDescription: "e.g., Weekend hikes, trail recommendations, and outdoor adventures for nature lovers of every skill level." },
      { name: "running", displayName: "Running", icon: "walk", image: "/images/categories/running.jpg", placeholderName: "e.g., Morning Mile Crew", placeholderTagline: "e.g., Lace up and hit the road together", placeholderDescription: "e.g., A group for runners of all levels who want to train, share routes, and stay motivated together." },
      { name: "cycling", displayName: "Cycling", icon: "bicycle", image: "/images/categories/biking.jpg", placeholderName: "e.g., Pedal Pals", placeholderTagline: "e.g., Ride together, go further", placeholderDescription: "e.g., Group rides, route sharing, and bike maintenance tips for cyclists in the neighborhood." },
      { name: "yoga", displayName: "Yoga", icon: "body", image: "/images/categories/yoga.jpg", placeholderName: "e.g., Flow Together", placeholderTagline: "e.g., Stretch, breathe, and find your balance", placeholderDescription: "e.g., Group yoga sessions, pose tutorials, and mindfulness practices for yogis of all levels." },
      { name: "fitness_classes", displayName: "Fitness Classes", icon: "barbell", image: "/images/categories/fitness-classes.jpg", placeholderName: "e.g., FitFam Local", placeholderTagline: "e.g., Sweat it out together", placeholderDescription: "e.g., Join group fitness classes, bootcamps, and workout sessions with neighbors who love staying active." },
      { name: "dance", displayName: "Dance", icon: "musical-notes", image: "/images/categories/dance.jpg", placeholderName: "e.g., Rhythm & Moves", placeholderTagline: "e.g., Dance like nobody's watching", placeholderDescription: "e.g., Salsa, hip-hop, ballroom or freestyle — find your groove with fellow dance lovers nearby." },
      { name: "pickleball", displayName: "Pickleball", icon: "tennisball", image: "/images/categories/pickleball.jpg", placeholderName: "e.g., Pickle Posse", placeholderTagline: "e.g., Dink, drive, and have fun", placeholderDescription: "e.g., Casual and competitive pickleball games for players of all levels in your area." },
      { name: "team_sports", displayName: "Team Sports", icon: "football", image: "/images/categories/team-sports.jpg", placeholderName: "e.g., Weekend Warriors", placeholderTagline: "e.g., Play together, win together", placeholderDescription: "e.g., Organize pickup games, leagues, and scrimmages for basketball, soccer, volleyball and more." },
      { name: "tennis", displayName: "Tennis", icon: "tennisball", image: "/images/categories/tennis.jpg", placeholderName: "e.g., Local Racket Club", placeholderTagline: "e.g., Find your doubles partner", placeholderDescription: "e.g., Casual rallies, friendly matches, and skill-building sessions for tennis enthusiasts nearby." },
    ],
  },
  {
    name: "creative", displayName: "Creative", icon: "color-palette",
    children: [
      { name: "cooking", displayName: "Cooking", icon: "restaurant", image: "/images/categories/cooking.jpg", placeholderName: "e.g., Home Chef Collective", placeholderTagline: "e.g., Cook, share, and savor together", placeholderDescription: "e.g., Swap recipes, host cook-alongs, and explore cuisines from around the world with fellow foodies." },
      { name: "arts_and_crafts", displayName: "Arts and Crafts", icon: "brush", image: "/images/categories/arts-crafts.jpg", placeholderName: "e.g., Creative Corner", placeholderTagline: "e.g., Make something beautiful together", placeholderDescription: "e.g., Share your creations, join craft nights, and learn new techniques with fellow artists and makers." },
      { name: "photography", displayName: "Photography", icon: "camera", image: "/images/categories/photography.jpg", placeholderName: "e.g., Shutter Squad", placeholderTagline: "e.g., Capture the moment together", placeholderDescription: "e.g., Photo walks, editing tips, and portfolio sharing for photographers at every level." },
      { name: "music", displayName: "Music", icon: "musical-notes", image: "/images/categories/music.jpg", placeholderName: "e.g., Jam Session Crew", placeholderTagline: "e.g., Make music, make friends", placeholderDescription: "e.g., Jam sessions, open mics, and music appreciation meetups for musicians and music lovers." },
      { name: "book_clubs", displayName: "Book Clubs", icon: "book", placeholderName: "e.g., Page Turners", placeholderTagline: "e.g., Read, discuss, repeat", placeholderDescription: "e.g., Monthly book picks, lively discussions, and literary adventures with fellow readers nearby." },
      { name: "board_games", displayName: "Board Games", icon: "game-controller", image: "/images/categories/board-games.jpg", placeholderName: "e.g., Game Night Gang", placeholderTagline: "e.g., Roll the dice and have fun", placeholderDescription: "e.g., Regular game nights with board games, card games, and tabletop RPGs for all experience levels." },
    ],
  },
  {
    name: "food_and_social", displayName: "Food & Social", icon: "cafe",
    children: [
      { name: "coffee_meetups", displayName: "Coffee Meetups", icon: "cafe", image: "/images/categories/coffee.jpg", placeholderName: "e.g., Morning Brew Club", placeholderTagline: "e.g., Connecting over great coffee", placeholderDescription: "e.g., Casual meetups at local cafés to chat, network, and discover the best brews in town." },
      { name: "dining_out", displayName: "Dining Out", icon: "restaurant", image: "/images/categories/food-drink.jpg", placeholderName: "e.g., Flavor Explorers", placeholderTagline: "e.g., Taste the best spots in town", placeholderDescription: "e.g., Restaurant reviews, food crawls, and tasting events for anyone who loves discovering new flavors." },
      { name: "wine_and_spirits", displayName: "Wine and Spirits", icon: "wine", placeholderName: "e.g., Pour & Savor", placeholderTagline: "e.g., Sip, swirl, and socialize", placeholderDescription: "e.g., Wine tastings, brewery tours, and cocktail nights for enthusiasts of fine beverages." },
      { name: "brunch", displayName: "Brunch", icon: "sunny", placeholderName: "e.g., Sunday Brunch Bunch", placeholderTagline: "e.g., The best meal of the week", placeholderDescription: "e.g., Weekend brunch outings to discover the best mimosas, pancakes, and vibes in the area." },
      { name: "farmers_market", displayName: "Farmers Market", icon: "leaf", placeholderName: "e.g., Market Wanderers", placeholderTagline: "e.g., Shop local, eat fresh", placeholderDescription: "e.g., Explore local farmers markets together, share finds, and support local growers and artisans." },
    ],
  },
  {
    name: "lifestyle", displayName: "Lifestyle", icon: "heart",
    children: [
      { name: "dog_pet_groups", displayName: "Dog/Pet Groups", icon: "paw", image: "/images/categories/pets.jpg", placeholderName: "e.g., Paws & Friends", placeholderTagline: "e.g., Playdates for pets and their humans", placeholderDescription: "e.g., Connect with local pet owners for walks, playdates, pet-sitting swaps, and adorable photo shares." },
      { name: "family_circles", displayName: "Family Circles", icon: "people", placeholderName: "e.g., Parent Connect", placeholderTagline: "e.g., Raising kids together", placeholderDescription: "e.g., A supportive space for parents and caregivers to share tips, arrange playdates, and build community." },
      { name: "wellness", displayName: "Wellness", icon: "medkit", image: "/images/categories/wellness.jpg", placeholderName: "e.g., Mindful Living Circle", placeholderTagline: "e.g., Nurture your mind, body, and soul", placeholderDescription: "e.g., Meditation sessions, wellness challenges, and self-care tips to help you feel your best." },
      { name: "gardening", displayName: "Gardening", icon: "leaf", image: "/images/categories/gardening.jpg", placeholderName: "e.g., Green Thumb Gang", placeholderTagline: "e.g., Grow together, bloom together", placeholderDescription: "e.g., Tips, plant swaps, and garden tours for anyone who loves getting their hands in the dirt." },
    ],
  },
  {
    name: "adventure_and_outdoors", displayName: "Adventure & Outdoors", icon: "compass",
    children: [
      { name: "camping_and_backpacking", displayName: "Camping and Backpacking", icon: "bonfire", placeholderName: "e.g., Basecamp Crew", placeholderTagline: "e.g., Sleep under the stars", placeholderDescription: "e.g., Plan camping trips, share gear recommendations, and explore the great outdoors together." },
      { name: "beach_and_water", displayName: "Beach and Water", icon: "water", placeholderName: "e.g., Shore Squad", placeholderTagline: "e.g., Life's better by the water", placeholderDescription: "e.g., Beach days, surfing, kayaking, and water activities with fellow ocean and lake lovers." },
      { name: "travel_and_exploration", displayName: "Travel & Exploration", icon: "airplane", placeholderName: "e.g., Wanderlust Club", placeholderTagline: "e.g., Explore new places together", placeholderDescription: "e.g., Group trips, travel tips, and exploration meetups for adventurers who love discovering new destinations." },
    ],
  },
  {
    name: "community", displayName: "Community", icon: "people-circle",
    children: [
      { name: "volunteering_and_nonprofit", displayName: "Volunteering and Non-profit", icon: "hand-left", placeholderName: "e.g., Give Back Group", placeholderTagline: "e.g., Make a difference together", placeholderDescription: "e.g., Organize volunteer events, support local causes, and connect with others who want to give back." },
      { name: "neighborhood_groups", displayName: "Neighborhood Groups", icon: "home", image: "/images/categories/community.jpg", placeholderName: "e.g., Neighborhood Circle", placeholderTagline: "e.g., Bringing neighbors closer together", placeholderDescription: "e.g., A hub for local events, safety updates, recommendations, and getting to know the people around you." },
    ],
  },
  {
    name: "professional", displayName: "Professional", icon: "briefcase",
    children: [
      { name: "startup_and_founders", displayName: "Startup & Founders", icon: "rocket", placeholderName: "e.g., Founders Circle", placeholderTagline: "e.g., Build something great together", placeholderDescription: "e.g., Connect with fellow founders, share startup journeys, and find co-founders and collaborators." },
      { name: "tech_meetups", displayName: "Tech Meetups", icon: "code-slash", placeholderName: "e.g., Local Dev Collective", placeholderTagline: "e.g., Code, learn, and connect", placeholderDescription: "e.g., Tech talks, hackathons, and coding sessions for developers and tech enthusiasts in the area." },
      { name: "professional_networking", displayName: "Professional Networking", icon: "briefcase", image: "/images/categories/professional.jpg", placeholderName: "e.g., Career Connect Hub", placeholderTagline: "e.g., Grow your network, grow your career", placeholderDescription: "e.g., A space for professionals to share advice, find mentors, and explore new opportunities together." },
      { name: "coworking_and_work_buddies", displayName: "Coworking and Work Buddies", icon: "laptop", placeholderName: "e.g., Work Together Crew", placeholderTagline: "e.g., Productive company nearby", placeholderDescription: "e.g., Find coworking partners, share workspace recommendations, and stay motivated working alongside others." },
    ],
  },
  {
    name: "campus", displayName: "Campus", icon: "school",
    children: [
      { name: "clubs", displayName: "Clubs", icon: "people", placeholderName: "e.g., Campus Club Hub", placeholderTagline: "e.g., Find your people on campus", placeholderDescription: "e.g., Discover and join student clubs, organizations, and interest groups at your university." },
      { name: "study_groups", displayName: "Study Groups", icon: "book", placeholderName: "e.g., Study Squad", placeholderTagline: "e.g., Learn better together", placeholderDescription: "e.g., Form study groups for classes, share notes, and prepare for exams with fellow students." },
      { name: "greek_life", displayName: "Greek Life", icon: "trophy", placeholderName: "e.g., Greek Connect", placeholderTagline: "e.g., Brotherhood and sisterhood", placeholderDescription: "e.g., Connect with members of fraternities and sororities, plan events, and build lifelong bonds." },
      { name: "intramural_sports", displayName: "Intramural Sports", icon: "football", placeholderName: "e.g., Campus Athletes", placeholderTagline: "e.g., Compete and have fun", placeholderDescription: "e.g., Join intramural teams, find practice partners, and compete in campus sports leagues." },
      { name: "campus_events", displayName: "Campus Events", icon: "calendar", placeholderName: "e.g., Campus Happenings", placeholderTagline: "e.g., Never miss a campus event", placeholderDescription: "e.g., Stay updated on campus events, concerts, lectures, and social gatherings at your university." },
    ],
  },
];

export async function seedCategories() {
  const existingCategories = await db.select().from(categories);

  if (existingCategories.length > 0) {
    const existingNames = new Set(existingCategories.map(c => c.name));

    const allExpectedNames = new Set<string>();
    for (const parent of categoryTree) {
      allExpectedNames.add(parent.name);
      for (const child of parent.children) {
        allExpectedNames.add(child.name);
      }
    }

    const hasNewStructure = categoryTree.some(p => existingNames.has(p.name) && existingCategories.find(c => c.name === p.name)?.parentId === null);
    const hasOldFlatStructure = existingNames.has("Running") || existingNames.has("Cooking");

    if (hasOldFlatStructure && !existingNames.has("active")) {
      console.log("[SEED] Detected old flat category structure, clearing and reseeding...");
      await db.delete(categories);
    } else if (!hasOldFlatStructure && existingNames.has("active")) {
      console.log("[SEED] Hierarchical categories already exist, updating placeholders...");
      for (const parent of categoryTree) {
        for (const child of parent.children) {
          await db.update(categories)
            .set({
              displayName: child.displayName,
              image: child.image || null,
              placeholderName: child.placeholderName,
              placeholderTagline: child.placeholderTagline,
              placeholderDescription: child.placeholderDescription,
            })
            .where(eq(categories.name, child.name));
        }
      }
      console.log("[SEED] Categories placeholders updated");
      return;
    }
  }

  for (const parent of categoryTree) {
    const [inserted] = await db.insert(categories).values({
      name: parent.name,
      displayName: parent.displayName,
      icon: parent.icon,
      image: null,
      parentId: null,
      placeholderName: null,
      placeholderTagline: null,
      placeholderDescription: null,
    }).returning();

    for (const child of parent.children) {
      await db.insert(categories).values({
        name: child.name,
        displayName: child.displayName,
        icon: child.icon,
        image: child.image || null,
        parentId: inserted.id,
        placeholderName: child.placeholderName,
        placeholderTagline: child.placeholderTagline,
        placeholderDescription: child.placeholderDescription,
      });
    }
  }

  console.log("[SEED] Hierarchical categories seeded successfully (8 parents, subcategories)");
}
