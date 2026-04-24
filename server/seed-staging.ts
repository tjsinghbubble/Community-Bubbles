import { db } from "./db";
import { storage } from "./storage";
import { bubbles, memberships, events, users, eventAttendees, bulletinBoards, bulletinPosts, bulletinPostTypes, bulletinPostReactions, bulletinReplies } from "@shared/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { seedBubbleImages } from "./seed-bubble-images";

const LOG = "[seed-staging]";

// ─── USERS ────────────────────────────────────────────────────────────────────

const SEED_USERS: Array<{
  name: string;
  email: string;
  isSuperAdmin: boolean;
  interests: string[];
}> = [
  { name: "SysAdmin",         email: "sysadmin@seinfeld.com", isSuperAdmin: true,  interests: ["Running", "Tennis", "Cooking"] },
  { name: "Elaine Benes",     email: "elaine@seinfeld.com",   isSuperAdmin: false, interests: ["Dancing", "Reading", "Coffee Meetups"] },
  { name: "Estelle Costanza", email: "estelle@seinfeld.com",  isSuperAdmin: false, interests: ["Cooking", "Pets", "Wellness"] },
  { name: "Frank Costanza",   email: "frank@seinfeld.com",    isSuperAdmin: false, interests: ["Soccer", "Billiards", "Cooking"] },
  { name: "George Costanza",  email: "george@seinfeld.com",   isSuperAdmin: true,  interests: ["Basketball", "Tennis", "Board Games"] },
  { name: "J. Peterman",      email: "peterman@seinfeld.com", isSuperAdmin: false, interests: ["Karting", "Tennis", "Dining Out"] },
  { name: "Jerry Seinfeld",   email: "jerry@seinfeld.com",    isSuperAdmin: false, interests: ["Tennis", "Comedy", "Coffee Meetups"] },
  { name: "Cosmo Kramer",     email: "kramer@seinfeld.com",   isSuperAdmin: false, interests: ["Pets", "Tennis", "Cooking"] },
  { name: "Larry David",      email: "larry@seinfeld.com",    isSuperAdmin: false, interests: ["Cricket", "Running", "Comedy"] },
  { name: "Newman",           email: "newman@seinfeld.com",   isSuperAdmin: false, interests: ["Karting", "Soccer", "Cooking"] },
];

// ─── BUBBLES ──────────────────────────────────────────────────────────────────

interface BubbleConfig {
  title: string;
  tagline: string;
  category: string;
  description: string;
  rules: string[];
  privacy: string;
  locationName: string;
  locationAddress: string;
  cadence: keyof typeof CADENCE_DATES;
  startTime: string;
  endTime: string;
  eventTitles: [string, string];
  eventDescription: string;
}

const BUBBLE_CONFIGS: BubbleConfig[] = [
  {
    title: "Basketball",
    tagline: "Ballers welcome — show up and run",
    category: "Sports & Fitness",
    description: "Pickup basketball for all skill levels at Mission Dolores Park. We run 3-on-3 and 5-on-5 depending on turnout. Competitive but friendly — check your ego at the gate.",
    rules: ["Call your fouls", "Winners stay, losers rotate", "No cherry-picking", "Be on time — games start without you"],
    privacy: "Public",
    locationName: "Mission Dolores Park",
    locationAddress: "Dolores St & 20th St, San Francisco, CA",
    cadence: "mon-wed",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Monday Pickup Run", "Wednesday Pickup Run"],
    eventDescription: "Pickup basketball at Mission Dolores Park. All skill levels welcome. First come, first on court.",
  },
  {
    title: "Tennis",
    tagline: "Rallies, sets, and good company",
    category: "Tennis",
    description: "Casual tennis meetups at Dolores Park courts. All levels welcome — from beginners to club players. We do singles, doubles, and round-robin drills depending on who shows up.",
    rules: ["Share court time fairly", "Bring your own racket", "Call the score clearly", "Good sportsmanship always"],
    privacy: "Public",
    locationName: "Dolores Park Tennis Courts",
    locationAddress: "Dolores St, San Francisco, CA",
    cadence: "tue-thu",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Tuesday Morning Tennis", "Thursday Morning Tennis"],
    eventDescription: "Morning tennis at Dolores Park. Bring your racket and water. All levels welcome.",
  },
  {
    title: "Cricket",
    tagline: "Bat, bowl, and bond over cricket",
    category: "Sports & Fitness",
    description: "Weekend cricket at Crocker Amazon Park. We play tape-ball and hardball formats depending on the group. Players of all backgrounds welcome — expats, locals, and curious newcomers alike.",
    rules: ["Respect the pitch and the park", "Rotate batting orders fairly", "Know the basic rules before playing", "Bring water and sunscreen"],
    privacy: "Public",
    locationName: "Crocker Amazon Park",
    locationAddress: "Geneva Ave & Moscow St, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "10:00",
    endTime: "14:00",
    eventTitles: ["Saturday Cricket Match", "Sunday Cricket Match"],
    eventDescription: "Weekend cricket at Crocker Amazon Park. Tape-ball and hardball formats. All backgrounds welcome.",
  },
  {
    title: "Soccer",
    tagline: "The beautiful game, your neighborhood",
    category: "Sports & Fitness",
    description: "Pickup soccer at Beach Chalet Fields with a passionate mix of skill levels. We play 6-a-side and 7-a-side. Great way to get a solid workout and make friends who love the game.",
    rules: ["Call fouls honestly", "No slide tackles unless agreed", "Sub fairly", "Cleats or turf shoes required"],
    privacy: "Public",
    locationName: "Beach Chalet Athletic Fields",
    locationAddress: "1000 Great Hwy, San Francisco, CA",
    cadence: "mon-wed",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Monday Soccer Pickup", "Wednesday Soccer Pickup"],
    eventDescription: "Pickup soccer at Beach Chalet Fields. 6 and 7-a-side games, all skill levels.",
  },
  {
    title: "Tennis Circle",
    tagline: "Intermediate and above — serious fun",
    category: "Tennis",
    description: "A step up from casual meetups — Tennis Circle is for intermediate to advanced players who want structured practice, drilling, and competitive sets. We rotate partners weekly.",
    rules: ["Intermediate+ level required", "RSVP at least 24 hours in advance", "Bring two cans of balls per session", "Respect court time limits"],
    privacy: "Request to Join",
    locationName: "Golden Gate Park Tennis Courts",
    locationAddress: "Middle Dr, San Francisco, CA",
    cadence: "tue-thu",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Tuesday Circle Session", "Thursday Circle Session"],
    eventDescription: "Structured tennis practice for intermediate to advanced players. Partner rotation included.",
  },
  {
    title: "SF Pickleball Crew",
    tagline: "Dinking in the city by the bay",
    category: "Sports",
    description: "Weekend pickleball at Noe Valley Rec Center. We welcome all levels — beginners, intermediate, and competitive players. Games are fun, rotations are fair, and the vibe is welcoming.",
    rules: ["Rotate courts every 11 points", "Announce your skill level", "Bring your own paddle if you have one", "Respect the rec center rules"],
    privacy: "Public",
    locationName: "Noe Valley Recreation Center",
    locationAddress: "24th St & Sanchez St, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Saturday Pickleball", "Sunday Pickleball"],
    eventDescription: "Weekend pickleball at Noe Valley Rec Center. All skill levels welcome. Court rotations every 11 points.",
  },
  {
    title: "Campus hoops",
    tagline: "College energy, open to all",
    category: "Sports & Fitness",
    description: "Basketball pickup at SFSU gymnasium — fast-paced, competitive, and high energy. We attract a younger crowd but everyone is welcome. Must be comfortable with competitive play.",
    rules: ["Respect gym rules at all times", "Call your fouls", "No dunking unless the hoop allows it", "Check in at the front desk"],
    privacy: "Public",
    locationName: "SFSU Gymnasium",
    locationAddress: "1600 Holloway Ave, San Francisco, CA",
    cadence: "mon-wed",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Monday Hoops", "Wednesday Hoops"],
    eventDescription: "Competitive pickup basketball at SFSU Gymnasium. Fast-paced, all welcome.",
  },
  {
    title: "Billiards",
    tagline: "Eight ball, nine ball, good times",
    category: "Sports & Fitness",
    description: "Pool nights at Slate Billiards in the Mission. We play 8-ball, 9-ball, and straight pool depending on the group. Great atmosphere, cold drinks optional, skill levels all welcome.",
    rules: ["Call your shots on 8-ball", "No hustling beginners", "Respect table etiquette", "Share tables when the bar is busy"],
    privacy: "Public",
    locationName: "Slate Billiards",
    locationAddress: "2178 Mission St, San Francisco, CA",
    cadence: "tue-thu",
    startTime: "19:00",
    endTime: "22:00",
    eventTitles: ["Tuesday Pool Night", "Thursday Pool Night"],
    eventDescription: "Pool night at Slate Billiards. 8-ball, 9-ball, and straight pool. All skill levels welcome.",
  },
  {
    title: "Karting",
    tagline: "Race days and rivalries",
    category: "Sports & Fitness",
    description: "Indoor go-kart racing at K1 Speed in Daly City. We book group sessions on weekends and run friendly time trials. Competitive but all in good fun — helmets required, trash talk optional.",
    rules: ["Sign waiver before arrival", "No aggressive contact", "Respect track marshals", "Helmet stays on until you exit the kart"],
    privacy: "Public",
    locationName: "K1 Speed",
    locationAddress: "111 Gellert Blvd, Daly City, CA",
    cadence: "sat-sun",
    startTime: "13:00",
    endTime: "16:00",
    eventTitles: ["Saturday Race Day", "Sunday Race Day"],
    eventDescription: "Group go-kart session at K1 Speed. Sign waiver on arrival. Helmets required.",
  },
  {
    title: "ABC Farm",
    tagline: "Grow food, build community",
    category: "Running",
    description: "Community gardening and farming meetups at Alemany Farm. We weed, plant, harvest, and share produce together. Great for families, individuals, and anyone who wants to connect with the land.",
    rules: ["Wear clothes you can get dirty", "Bring gloves if you have them", "Take only what you harvest", "Respect the farm's guidelines"],
    privacy: "Request to Join",
    locationName: "Alemany Farm",
    locationAddress: "700 Alemany Blvd, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Saturday Farm Day", "Sunday Farm Day"],
    eventDescription: "Community farming at Alemany Farm. Weeding, planting, and harvesting together. Wear old clothes.",
  },
  {
    title: "Bark at Dogpatch",
    tagline: "Dogs and humans socializing together",
    category: "Pets",
    description: "Dog-friendly weekend meetups at Esprit Park in Dogpatch. Bring your pup for off-leash play, socialization, and owner hangouts. We swap training tips and make sure all dogs play nicely.",
    rules: ["Dogs must be vaccinated", "Always pick up after your dog", "No aggressive dogs — remove them if needed", "Keep an eye on your pet at all times"],
    privacy: "Public",
    locationName: "Esprit Park",
    locationAddress: "Cesar Chavez St & Illinois St, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Saturday Bark & Roam", "Sunday Bark & Roam"],
    eventDescription: "Off-leash dog socializing and owner hangout at Esprit Park. All friendly dogs welcome.",
  },
  {
    title: "Corgi Farm",
    tagline: "Corgis, community, and maybe some cooking",
    category: "Cooking",
    description: "Weekend meetups for corgi owners and admirers in Noe Valley. We combine dog socializing with casual cooking and food sharing. It is exactly what it sounds like and it is wonderful.",
    rules: ["Corgis must be on leash unless in designated areas", "Share what you bring", "Respect allergies when bringing food", "Keep it fun and relaxed"],
    privacy: "Request to Join",
    locationName: "Noe Valley",
    locationAddress: "Noe Valley, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Saturday Corgi Meetup", "Sunday Corgi Meetup"],
    eventDescription: "Corgi socialization and casual food sharing in Noe Valley. Bring your corgi and a dish to share.",
  },
  {
    title: "Mexican food",
    tagline: "Tacos, tamales, and tasting everything",
    category: "Food & Social",
    description: "A foodie group for exploring the best Mexican food in San Francisco. We hit a new taqueria, food truck, or restaurant every meetup — everything from street tacos to Oaxacan specialties.",
    rules: ["Come hungry", "Try something you have never had before", "Split dishes and share the experience", "No food waste — take leftovers home"],
    privacy: "Public",
    locationName: "Mission District",
    locationAddress: "Mission District, San Francisco, CA",
    cadence: "fri-sat",
    startTime: "19:00",
    endTime: "21:00",
    eventTitles: ["Friday Taco Night", "Saturday Street Food Tour"],
    eventDescription: "Group dinner exploring the best Mexican food in the Mission District. Come hungry.",
  },
  {
    title: "Mexican Food Truck",
    tagline: "Finding the city's best rolling kitchens",
    category: "Cooking",
    description: "Private group for serious Mexican food truck hunters. We research, scout, and visit the best trucks across SF and the Bay Area. Members get first access to our curated food truck map.",
    rules: ["Keep truck locations within the group", "Leave honest reviews", "Respect the vendors and their craft", "Members only — do not share the invite link"],
    privacy: "Private",
    locationName: "SoMa StrEat Food Park",
    locationAddress: "428 11th St, San Francisco, CA",
    cadence: "wed-fri",
    startTime: "19:00",
    endTime: "21:00",
    eventTitles: ["Wednesday Food Truck Night", "Friday Food Truck Night"],
    eventDescription: "Members-only food truck scouting night. Location revealed to confirmed RSVPs only.",
  },
  {
    title: "Mindful Mamas",
    tagline: "Wellness for moms, by moms",
    category: "Wellness",
    description: "A supportive wellness group for mothers in the Bernal Heights area. We do morning walks, meditation, yoga, and open discussions on mental health and self-care. Babies and toddlers welcome.",
    rules: ["This is a judgment-free space", "Support each other — no unsolicited advice", "Be present and put your phone away during sessions", "Respect everyone's journey"],
    privacy: "Public",
    locationName: "Bernal Heights Park",
    locationAddress: "Bernal Heights Blvd, San Francisco, CA",
    cadence: "mon-wed",
    startTime: "08:00",
    endTime: "09:30",
    eventTitles: ["Monday Morning Walk", "Wednesday Wellness Circle"],
    eventDescription: "Supportive wellness session for moms. Morning walk, meditation, and open discussion. Babies welcome.",
  },
  {
    title: "My Test Bubble nRgP",
    tagline: "Weekend runners and trail explorers",
    category: "Running",
    description: "Weekend running group starting from Crissy Field with routes along the waterfront and into the Presidio. All paces welcome — we split into groups by speed. Beautiful views guaranteed.",
    rules: ["Always run with a buddy", "Bring water and fuel for longer runs", "Communicate your pace honestly", "Leave no trace on the trails"],
    privacy: "Public",
    locationName: "Crissy Field",
    locationAddress: "1199 E Beach, San Francisco, CA",
    cadence: "sat-sun",
    startTime: "09:00",
    endTime: "11:00",
    eventTitles: ["Saturday Morning Run", "Sunday Long Run"],
    eventDescription: "Weekend run from Crissy Field along the waterfront and Presidio trails. All paces, all welcome.",
  },
  {
    title: "Larry Bubble",
    tagline: "Larry's world — you're just visiting",
    category: "Sports & Fitness",
    description: "A mixed sports and social group organized by Larry. We rotate between different activities each week — tennis, basketball, and the occasional heated discussion about who was actually in the right.",
    rules: ["Pretty, pretty, pretty good behavior required", "Do not double-book without notice", "Agree to disagree", "Larry reserves the right to be right"],
    privacy: "Public",
    locationName: "TBD",
    locationAddress: "San Francisco, CA",
    cadence: "tue-thu",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Tuesday Activity", "Thursday Activity"],
    eventDescription: "Rotating sports and social activity organized by Larry. Activity announced week-of.",
  },
  {
    title: "foo ar",
    tagline: "The bubble that defies categorization",
    category: "Sports & Fitness",
    description: "A catch-all sports and social bubble for the adventurous and experimental. We try things, break things, fix things, and occasionally win things. What happens here stays here.",
    rules: ["Show up willing to try anything", "No judgment", "Be safe", "Have fun or we will find out why you are not"],
    privacy: "Public",
    locationName: "TBD",
    locationAddress: "San Francisco, CA",
    cadence: "tue-fri",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Tuesday Session", "Friday Session"],
    eventDescription: "Whatever we decide to do — show up ready for anything.",
  },
  {
    title: "Testing",
    tagline: "A test bubble for testing things",
    category: "Food & Drink",
    description: "Used for testing the Bubble platform features. Members join to verify flows, test notifications, and make sure things work as expected. If you're seeing this in production, it's working.",
    rules: ["Test thoroughly", "Report bugs kindly", "Do not delete other people's test data", "Have fun with it"],
    privacy: "Public",
    locationName: "TBD",
    locationAddress: "San Francisco, CA",
    cadence: "mon-thu",
    startTime: "18:00",
    endTime: "20:00",
    eventTitles: ["Monday Test Event", "Thursday Test Event"],
    eventDescription: "Test event for verifying platform features. RSVP and notification flows included.",
  },
];

// ─── EVENT DATE CADENCES ──────────────────────────────────────────────────────
// Week 1: Apr 20–26 (April 20 = Monday, confirmed April 19 = Sunday)
// Week 2: May 4–10
// Week 3: May 11–17
// Week 4: May 18–24

const CADENCE_DATES = {
  "mon-wed": [["2026-04-20", "2026-04-22"], ["2026-05-04", "2026-05-06"], ["2026-05-11", "2026-05-13"], ["2026-05-18", "2026-05-20"]],
  "tue-thu": [["2026-04-21", "2026-04-23"], ["2026-05-05", "2026-05-07"], ["2026-05-12", "2026-05-14"], ["2026-05-19", "2026-05-21"]],
  "sat-sun": [["2026-04-25", "2026-04-26"], ["2026-05-09", "2026-05-10"], ["2026-05-16", "2026-05-17"], ["2026-05-23", "2026-05-24"]],
  "fri-sat": [["2026-04-24", "2026-04-25"], ["2026-05-08", "2026-05-09"], ["2026-05-15", "2026-05-16"], ["2026-05-22", "2026-05-23"]],
  "wed-fri": [["2026-04-22", "2026-04-24"], ["2026-05-06", "2026-05-08"], ["2026-05-13", "2026-05-15"], ["2026-05-20", "2026-05-22"]],
  "tue-fri": [["2026-04-21", "2026-04-24"], ["2026-05-05", "2026-05-08"], ["2026-05-12", "2026-05-15"], ["2026-05-19", "2026-05-22"]],
  "mon-thu": [["2026-04-20", "2026-04-23"], ["2026-05-04", "2026-05-07"], ["2026-05-11", "2026-05-14"], ["2026-05-18", "2026-05-21"]],
} as const;

// ─── MEMBERSHIP MATRIX ────────────────────────────────────────────────────────
// admins implies membership (role="admin"); members = role="member", status="approved"

const MEMBERSHIP_MATRIX: Record<string, { admins: string[]; members: string[] }> = {
  "ABC Farm":            { admins: ["sysadmin@seinfeld.com", "kramer@seinfeld.com", "newman@seinfeld.com"],   members: ["elaine@seinfeld.com", "jerry@seinfeld.com"] },
  "Bark at Dogpatch":   { admins: ["sysadmin@seinfeld.com", "jerry@seinfeld.com"],                            members: ["kramer@seinfeld.com"] },
  "Basketball":         { admins: ["sysadmin@seinfeld.com", "frank@seinfeld.com"],                            members: ["elaine@seinfeld.com", "george@seinfeld.com", "peterman@seinfeld.com"] },
  "Billiards":          { admins: ["sysadmin@seinfeld.com", "george@seinfeld.com"],                           members: ["elaine@seinfeld.com", "frank@seinfeld.com", "jerry@seinfeld.com"] },
  "Campus hoops":       { admins: ["sysadmin@seinfeld.com", "larry@seinfeld.com", "newman@seinfeld.com"],     members: ["frank@seinfeld.com", "george@seinfeld.com"] },
  "Corgi Farm":         { admins: ["sysadmin@seinfeld.com", "estelle@seinfeld.com", "frank@seinfeld.com"],    members: ["jerry@seinfeld.com"] },
  "Cricket":            { admins: ["sysadmin@seinfeld.com", "kramer@seinfeld.com"],                           members: ["estelle@seinfeld.com", "larry@seinfeld.com", "newman@seinfeld.com"] },
  "foo ar":             { admins: ["sysadmin@seinfeld.com", "frank@seinfeld.com", "larry@seinfeld.com"],      members: ["jerry@seinfeld.com", "newman@seinfeld.com"] },
  "Karting":            { admins: ["sysadmin@seinfeld.com", "peterman@seinfeld.com"],                         members: ["newman@seinfeld.com"] },
  "Larry Bubble":       { admins: ["sysadmin@seinfeld.com", "estelle@seinfeld.com", "larry@seinfeld.com"],    members: ["elaine@seinfeld.com", "george@seinfeld.com", "kramer@seinfeld.com"] },
  "Mexican food":       { admins: ["sysadmin@seinfeld.com", "george@seinfeld.com", "kramer@seinfeld.com"],    members: ["elaine@seinfeld.com", "estelle@seinfeld.com", "frank@seinfeld.com", "peterman@seinfeld.com", "jerry@seinfeld.com", "newman@seinfeld.com"] },
  "Mexican Food Truck": { admins: ["sysadmin@seinfeld.com", "elaine@seinfeld.com", "peterman@seinfeld.com"],  members: ["frank@seinfeld.com", "newman@seinfeld.com"] },
  "Mindful Mamas":      { admins: ["sysadmin@seinfeld.com", "elaine@seinfeld.com"],                           members: [] },
  "My Test Bubble nRgP":{ admins: ["sysadmin@seinfeld.com", "jerry@seinfeld.com"],                            members: ["elaine@seinfeld.com", "estelle@seinfeld.com", "larry@seinfeld.com"] },
  "SF Pickleball Crew": { admins: ["sysadmin@seinfeld.com", "jerry@seinfeld.com"],                            members: ["elaine@seinfeld.com", "estelle@seinfeld.com"] },
  "Soccer":             { admins: ["sysadmin@seinfeld.com", "newman@seinfeld.com"],                           members: ["frank@seinfeld.com", "jerry@seinfeld.com"] },
  "Tennis":             { admins: ["sysadmin@seinfeld.com", "elaine@seinfeld.com"],                           members: ["george@seinfeld.com", "peterman@seinfeld.com", "jerry@seinfeld.com"] },
  "Tennis Circle":      { admins: ["sysadmin@seinfeld.com", "george@seinfeld.com"],                           members: ["frank@seinfeld.com", "kramer@seinfeld.com"] },
  "Testing":            { admins: ["sysadmin@seinfeld.com", "estelle@seinfeld.com", "george@seinfeld.com"],   members: ["jerry@seinfeld.com", "kramer@seinfeld.com", "newman@seinfeld.com"] },
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function seedStaging(): Promise<void> {
  console.log(`${LOG} ===== Starting staging seed =====`);

  const hashedPwd = await bcrypt.hash("Bubble123!", 10);

  // ── Step 1: Users ─────────────────────────────────────────────────────────
  // Create if missing; always update password + isSuperAdmin to guarantee login.
  const userMap: Record<string, string> = {};

  for (const u of SEED_USERS) {
    try {
      const existing = await storage.getUserByEmail(u.email);
      if (existing) {
        userMap[u.email] = existing.id;
        await db
          .update(users)
          .set({ password: hashedPwd, isSuperAdmin: u.isSuperAdmin })
          .where(eq(users.id, existing.id));
        console.log(`${LOG} Updated user ${u.email} (${existing.id})`);
      } else {
        // Create without isSuperAdmin; apply it immediately after.
        const created = await storage.createUser({
          name: u.name,
          email: u.email,
          password: hashedPwd,
          interests: u.interests,
        });
        await db
          .update(users)
          .set({ isSuperAdmin: u.isSuperAdmin })
          .where(eq(users.id, created.id));
        userMap[u.email] = created.id;
        console.log(`${LOG} Created user ${u.email} (${created.id})`);
      }
    } catch (e) {
      console.error(`${LOG} Failed user ${u.email}:`, e);
    }
  }

  const sysAdminId = userMap["sysadmin@seinfeld.com"];
  if (!sysAdminId) {
    console.error(`${LOG} SysAdmin not found — aborting`);
    return;
  }

  // ── Step 2: Bubbles ───────────────────────────────────────────────────────
  const bubbleMap: Record<string, string> = {};

  for (const bc of BUBBLE_CONFIGS) {
    try {
      const existing = await db
        .select({ id: bubbles.id })
        .from(bubbles)
        .where(eq(bubbles.title, bc.title))
        .limit(1);

      if (existing.length > 0) {
        bubbleMap[bc.title] = existing[0].id;
        console.log(`${LOG} Bubble "${bc.title}" exists (${existing[0].id})`);
      } else {
        const [created] = await db
          .insert(bubbles)
          .values({
            title: bc.title,
            tagline: bc.tagline,
            category: bc.category,
            description: bc.description,
            rules: bc.rules,
            privacy: bc.privacy,
            locationName: bc.locationName,
            locationAddress: bc.locationAddress,
            creatorId: sysAdminId,
            status: "approved",
            members: 0,
          })
          .returning({ id: bubbles.id });
        bubbleMap[bc.title] = created.id;
        console.log(`${LOG} Created bubble "${bc.title}" (${created.id})`);
      }
    } catch (e) {
      console.error(`${LOG} Failed bubble "${bc.title}":`, e);
    }
  }

  // ── Step 3: Memberships ───────────────────────────────────────────────────
  for (const [bubbleTitle, { admins, members }] of Object.entries(MEMBERSHIP_MATRIX)) {
    const bubbleId = bubbleMap[bubbleTitle];
    if (!bubbleId) {
      console.error(`${LOG} Bubble not in map: "${bubbleTitle}"`);
      continue;
    }

    const allEntries = [
      ...admins.map(e => ({ email: e, role: "admin" as const })),
      ...members.map(e => ({ email: e, role: "member" as const })),
    ];

    let added = 0;
    for (const { email, role } of allEntries) {
      const userId = userMap[email];
      if (!userId) continue;

      try {
        const existing = await db
          .select({ id: memberships.id, role: memberships.role })
          .from(memberships)
          .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
          .limit(1);

        if (existing.length > 0) {
          if (role === "admin" && existing[0].role !== "admin") {
            await db
              .update(memberships)
              .set({ role: "admin" })
              .where(eq(memberships.id, existing[0].id));
          }
          continue;
        }

        await db.insert(memberships).values({
          userId,
          bubbleId,
          role,
          membershipStatus: "approved",
        });
        added++;
      } catch (e) {
        console.error(`${LOG} Failed membership ${email} -> ${bubbleTitle}:`, e);
      }
    }

    await db
      .update(bubbles)
      .set({ members: allEntries.length })
      .where(eq(bubbles.id, bubbleId));

    console.log(`${LOG} "${bubbleTitle}": ${admins.length}A + ${members.length}M (${added} new)`);
  }

  // ── Step 4: Events ────────────────────────────────────────────────────────
  // Guard: if a bubble already has >= 8 seeded events, skip it entirely.
  // Otherwise insert only missing dates for full idempotency on partial runs.
  for (const bc of BUBBLE_CONFIGS) {
    const bubbleId = bubbleMap[bc.title];
    if (!bubbleId) continue;

    const existingRows = await db
      .select({ date: events.date })
      .from(events)
      .where(and(eq(events.bubbleId, bubbleId), gte(events.date, "2026-04-20")));

    if (existingRows.length >= 8) {
      console.log(`${LOG} "${bc.title}" already has ${existingRows.length} seeded events — skipping`);
      continue;
    }

    const existingDates = new Set(existingRows.map(r => r.date));

    const datePairs = CADENCE_DATES[bc.cadence];
    let created = 0;

    for (const [day1, day2] of datePairs) {
      const pairs: Array<[string, string]> = [
        [day1, bc.eventTitles[0]],
        [day2, bc.eventTitles[1]],
      ];
      for (const [date, title] of pairs) {
        if (existingDates.has(date)) continue;
        try {
          await db.insert(events).values({
            title,
            description: bc.eventDescription,
            date,
            startTime: bc.startTime,
            endTime: bc.endTime,
            locationName: bc.locationName,
            locationAddress: bc.locationAddress,
            bubbleId,
            creatorId: sysAdminId,
            status: "approved",
            visibility: "public",
            timezone: "America/Los_Angeles",
          });
          existingDates.add(date);
          created++;
        } catch (e) {
          console.error(`${LOG} Failed event "${title}" on ${date} for "${bc.title}":`, e);
        }
      }
    }

    if (created > 0 || existingDates.size > 0) {
      console.log(`${LOG} Events for "${bc.title}": ${created} new, ${existingDates.size} total`);
    }
  }

  // ── Step 5: Event RSVPs ───────────────────────────────────────────────────
  // For each bubble's events, RSVP 2–5 members with status "going".
  // Idempotent: skips any (userId, eventId) pair that already exists.
  console.log(`${LOG} ── Step 5: seeding event RSVPs ──`);

  for (const bc of BUBBLE_CONFIGS) {
    const bubbleId = bubbleMap[bc.title];
    if (!bubbleId) continue;

    const matrix = MEMBERSHIP_MATRIX[bc.title];
    if (!matrix) continue;

    // Collect all member userIds for this bubble (admins + members).
    const allEmails = [...matrix.admins, ...matrix.members];
    const memberIds = allEmails.map(e => userMap[e]).filter(Boolean) as string[];
    if (memberIds.length < 2) continue;

    // Fetch all events for this bubble.
    const bubbleEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.bubbleId, bubbleId), gte(events.date, "2026-04-20")));

    let totalAdded = 0;

    for (const ev of bubbleEvents) {
      // Fetch existing attendees for this event so we stay idempotent.
      const existing = await db
        .select({ userId: eventAttendees.userId })
        .from(eventAttendees)
        .where(eq(eventAttendees.eventId, ev.id));

      const existingUserIds = new Set(existing.map(r => r.userId));

      // Deterministically pick 2–5 attendees using the event id as a seed.
      // Use a simple hash of the event id characters to get a consistent offset.
      const hash = ev.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const count = 2 + (hash % (Math.min(memberIds.length, 5) - 1));
      const offset = hash % memberIds.length;

      // Rotate member list starting at offset so different events get different attendees.
      const rotated = [...memberIds.slice(offset), ...memberIds.slice(0, offset)];
      const picks = rotated.slice(0, count);

      for (const userId of picks) {
        if (existingUserIds.has(userId)) continue;
        try {
          await db.insert(eventAttendees).values({
            eventId: ev.id,
            userId,
            status: "going",
          });
          totalAdded++;
        } catch (e) {
          console.error(`${LOG} Failed RSVP userId=${userId} eventId=${ev.id}:`, e);
        }
      }
    }

    console.log(`${LOG} "${bc.title}": ${bubbleEvents.length} events, ${totalAdded} RSVPs added`);
  }

  // ── Step 6: Bulletin Board Posts ─────────────────────────────────────────
  // For each bubble, ensure a bulletin board exists then seed 2–4 thematic posts.
  // Idempotent: if the board already has ≥ 2 posts it is skipped entirely.
  console.log(`${LOG} ── Step 6: seeding bulletin board posts ──`);

  const postTypeRows = await db
    .select({ id: bulletinPostTypes.id, name: bulletinPostTypes.name })
    .from(bulletinPostTypes);
  const postTypeMap: Record<string, number> = {};
  for (const pt of postTypeRows) postTypeMap[pt.name] = pt.id;

  const annType  = postTypeMap["announcements"];
  const genType  = postTypeMap["general"];
  const helpType = postTypeMap["help_exchange"];

  if (!annType || !genType) {
    console.warn(`${LOG} Post types not found — skipping bulletin board seeding`);
  } else {
    // Seeded post definitions keyed by bubble title.
    // typeKey → "ann" = announcements, "gen" = general, "help" = help_exchange
    type PostDef = { typeKey: "ann" | "gen" | "help"; authorEmail: string; title: string; body: string; isPinned?: boolean; daysAgo: number };
    const BULLETIN_POSTS: Record<string, PostDef[]> = {
      "Basketball": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Season kick-off — Monday at Dolores!",          body: "We're back at Mission Dolores Park every Monday and Wednesday at 6 PM. First come, first court. Bring water and energy. Winners stay, losers rotate.", isPinned: true, daysAgo: 10 },
        { typeKey: "gen",  authorEmail: "frank@seinfeld.com",    title: "Who's bringing a ball this Wednesday?",          body: "Lost mine at last session. Who's got one? Two would be better — we had 10 people last time and the wait between runs was brutal.", daysAgo: 7 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "3-on-3 tournament — sign up by Friday",         body: "We're running a casual 3-on-3 bracket next month. All skill levels welcome. Drop your name below or DM me. Need at least 6 teams.", daysAgo: 4 },
        { typeKey: "gen",  authorEmail: "george@seinfeld.com",   title: "Best warmup before pickup?",                    body: "Keep rolling an ankle on cold starts. What are you doing to warm up before games? Suggestions appreciated.", daysAgo: 2 },
      ],
      "Tennis": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Court resurfacing done — we're back!",          body: "Dolores Park courts finished resurfacing last week. Same schedule, same vibe. Bring your racket and a can of balls to share.", isPinned: true, daysAgo: 9 },
        { typeKey: "gen",  authorEmail: "elaine@seinfeld.com",   title: "Looking for a hitting partner Tuesdays",        body: "Anyone free 30 min before the group session to rally? Happy to meet at 8:30 AM and warm up together.", daysAgo: 5 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Thursday session: doubles format this week",    body: "We have enough people signed up to run full doubles. Come ready to partner up — we'll assign pairs at the gate.", daysAgo: 2 },
      ],
      "Cricket": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Format vote — tape-ball or hardball this Sat?", body: "Depending on turnout we may go hardball. Cast your vote in the thread so we can prep the right kit. Majority rules.", isPinned: true, daysAgo: 8 },
        { typeKey: "gen",  authorEmail: "kramer@seinfeld.com",   title: "Anyone have a spare bat for Sunday?",           body: "Our second bat has a crack in the handle. Don't want to break it mid-match. If someone has a spare, please bring it.", daysAgo: 5 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Park permit confirmed through June",            body: "Good news — Crocker Amazon permit is renewed. We're locked in every Saturday and Sunday through end of June. No field conflicts.", daysAgo: 3 },
      ],
      "Soccer": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Turf rules reminder — no slide tackles",        body: "The Beach Chalet turf is new this season and the park district has asked us to keep slide tackles off the table. Agreed fouls only. Let's keep the field.", isPinned: true, daysAgo: 11 },
        { typeKey: "gen",  authorEmail: "newman@seinfeld.com",   title: "7-a-side this Monday if we hit 14 RSVP",        body: "We're at 11 confirmed. Need 3 more for full 7-a-side. Reply here if you can make it or invite a friend. Starts 6 PM sharp.", daysAgo: 4 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "New sub rotation — read before Wednesday",      body: "Going forward: subs rotate every 10 minutes regardless of score. Keeps things fair, reduces arguments. Any issues, bring them to me.", daysAgo: 2 },
      ],
      "Tennis Circle": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Level reminder — intermediate+ only",          body: "We've had a few beginners join and it's disrupting the flow. Please remind guests of the level requirement before they show up. Appreciate it.", isPinned: true, daysAgo: 12 },
        { typeKey: "ann",  authorEmail: "george@seinfeld.com",   title: "Bring two cans per session — new policy",      body: "Starting this week each member brings 2 fresh cans per session. Balls were getting too dead mid-drill. Easy fix.", daysAgo: 6 },
        { typeKey: "gen",  authorEmail: "frank@seinfeld.com",    title: "Anyone up for extra drilling Sunday AM?",       body: "Want to work on serve-and-volley. Happy to book a court independently. Let me know if interested — looking for 2–3 others.", daysAgo: 3 },
      ],
      "SF Pickleball Crew": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Noe Valley courts confirmed both days!",       body: "Permit came through — we've got the outdoor courts at Noe Valley Rec Center all weekend. Saturday and Sunday 9–11 AM. See you there.", isPinned: true, daysAgo: 9 },
        { typeKey: "gen",  authorEmail: "jerry@seinfeld.com",    title: "Paddle recommendations for beginners?",        body: "A friend wants to join but doesn't have gear. What paddles are you all using? Looking for something under $60 that's good for a first-timer.", daysAgo: 5 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Beginner-friendly rotation this Sunday",       body: "We're opening Sunday to mixed skill levels. Experienced players, please be patient with newer folks. It's how we grow the community.", daysAgo: 2 },
      ],
      "Campus hoops": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "SFSU gym check-in policy updated",             body: "The front desk now requires a photo ID to check in. Bring your ID every time — no exceptions from gym staff. Don't blame me, blame policy.", isPinned: true, daysAgo: 10 },
        { typeKey: "gen",  authorEmail: "larry@seinfeld.com",    title: "Dunking ban — who actually reads the rules?",  body: "Rims at SFSU are fragile. Please no dunking — it's been flagged twice now and we risk losing court access. Thank you.", daysAgo: 6 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Wednesday is packed — arrive early",           body: "Last Wednesday we had 22 people show up. If you want court time, aim for 5:45 PM. We do our best to keep runs moving.", daysAgo: 3 },
      ],
      "Billiards": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Slate Billiards: table reservation confirmed",  body: "We've pre-reserved 4 tables every Tuesday and Thursday from 7–10 PM. Check in at the bar under 'Billiards Group.' No walk-in fee for members.", isPinned: true, daysAgo: 8 },
        { typeKey: "gen",  authorEmail: "george@seinfeld.com",   title: "9-ball bracket idea — thoughts?",              body: "We've been doing mostly 8-ball. Anyone keen on running a 9-ball bracket one night? Something casual, buy-in optional.", daysAgo: 5 },
        { typeKey: "gen",  authorEmail: "frank@seinfeld.com",    title: "Table etiquette reminder",                     body: "Few folks have been jumping on occupied tables. If the balls are racked, the table is taken. Ask before you rack.", daysAgo: 2 },
      ],
      "Karting": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Sign your waiver before you arrive!",          body: "K1 Speed requires a waiver on file. Sign online at k1speed.com/waiver before Saturday so we don't lose 15 minutes at the front desk.", isPinned: true, daysAgo: 9 },
        { typeKey: "gen",  authorEmail: "peterman@seinfeld.com", title: "Saturday lap records — who's on top?",         body: "Best time last weekend was 28.4 seconds on the main track. Post your personal best below. Let's keep a leaderboard going.", daysAgo: 6 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Group discount unlocked — 8+ confirmed",       body: "We hit the 8-person threshold so K1 is giving us the group rate. That's $8 off per session per person. RSVP in the event to lock it in.", daysAgo: 3 },
      ],
      "ABC Farm": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Spring planting has started — all hands!",     body: "We kicked off spring planting this weekend. Tomatoes, peppers, and beans are in the ground. Come out to help with watering and composting.", isPinned: true, daysAgo: 11 },
        { typeKey: "gen",  authorEmail: "kramer@seinfeld.com",   title: "Gloves needed — anyone have extras?",          body: "We're short on medium gloves. If you have a spare pair collecting dust, please bring them Saturday. Or just buy a cheap pair — they last a season.", daysAgo: 6 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "First harvest share next Sunday!",             body: "We'll be harvesting lettuce and radishes for the first time this season. Bring a bag. Shares go to members who showed up this month first.", daysAgo: 2 },
        { typeKey: "help", authorEmail: "newman@seinfeld.com",   title: "Anyone know how to fix a drip irrigator?",     body: "One of the drip lines near row 3 is leaking at the joint. I've wrapped it but it's still slow-dripping. Anyone with irrigation know-how?", daysAgo: 1 },
      ],
      "Bark at Dogpatch": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Vaccination reminder — required to join!",     body: "Esprit Park off-leash area requires current vaccinations. Please bring your dog's vaccination record to the next meetup or share it with me.", isPinned: true, daysAgo: 8 },
        { typeKey: "gen",  authorEmail: "jerry@seinfeld.com",    title: "Any reactive dogs coming Saturday?",           body: "Just a heads up — I'm bringing my rescue who can be a bit tense with certain dogs. Happy to arrive 15 min late if it helps any owners.", daysAgo: 4 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "New off-leash rules at Esprit — read this",   body: "The park now enforces off-leash areas strictly. Keep dogs on leash until you reach the fenced section. City patrol has been active on weekends.", daysAgo: 2 },
      ],
      "Corgi Farm": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Corgi Farm Saturday: potluck theme is brunch", body: "This Saturday's food theme is brunch. Think quiches, pastries, fruit salads. Corgis will enjoy the chaos. Sign up what you're bringing below.", isPinned: true, daysAgo: 9 },
        { typeKey: "gen",  authorEmail: "estelle@seinfeld.com",  title: "My corgi just turned 2 — mini celebration?",  body: "Bagelach turns 2 this weekend! I'm bringing a dog-safe cake. Hope that's welcome. She loves other corgis and will be very wiggly.", daysAgo: 5 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Reminder: leashes until the open area",       body: "Let's keep dogs leashed on the street and in the cafe area. Once we're in the open courtyard it's free range. Keeps everyone safe and the neighbors happy.", daysAgo: 2 },
      ],
      "Mexican food": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "This Friday: La Taqueria on Mission",          body: "We're hitting La Taqueria at 7 PM. No reservations — we'll split into groups and reconvene. Come hungry. The carnitas burrito is non-negotiable.", isPinned: true, daysAgo: 7 },
        { typeKey: "gen",  authorEmail: "george@seinfeld.com",   title: "Best Oaxacan spot in the Mission?",           body: "Trying to plan a future stop. Has anyone been to Taqueria Cancun on Mission? Or is there a better Oaxacan place we should hit as a group?", daysAgo: 4 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Saturday: street food tour route published",   body: "The Saturday route hits 4 stops in the Mission over 2 hours. Bring $30 cash and an empty stomach. Full route pinned in the event details.", daysAgo: 2 },
        { typeKey: "gen",  authorEmail: "kramer@seinfeld.com",   title: "Tamale recommendation — El Buen Sabor",        body: "Stumbled on El Buen Sabor on 24th St. Their tamales are outstanding. Worth adding to a future group night.", daysAgo: 1 },
      ],
      "Mexican Food Truck": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Location unlocked — this Wednesday's truck",   body: "Wednesday night we're hitting a new truck on Capp St near 22nd. Location stays in this group. Meet at SoMa StrEat first for parking then carpool.", isPinned: true, daysAgo: 6 },
        { typeKey: "gen",  authorEmail: "elaine@seinfeld.com",   title: "Best fish taco truck in the city — debate",   body: "I say Gott's, Peterman says some truck in Daly City. Someone settle this. What's the best fish taco truck you've had in the Bay Area?", daysAgo: 3 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "New truck map updated — 7 spots added",        body: "Added 7 new verified trucks to the curated map. Link goes out to members only tonight. Keep it internal — these spots fill up fast on weekends.", daysAgo: 1 },
      ],
      "Mindful Mamas": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Monday Walk: Bernal Heights loop route",       body: "This Monday we're doing the full Bernal loop — about 2.2 miles with the hill. Stroller-friendly, pram-friendly, baby carrier welcome. Meet at the park entrance at 8 AM.", isPinned: true, daysAgo: 8 },
        { typeKey: "ann",  authorEmail: "elaine@seinfeld.com",   title: "Wednesday: guided meditation, 20 min",         body: "This week's circle starts with a 20-minute guided meditation led by a local practitioner. Free for all members. Bring a mat or blanket if you have one.", daysAgo: 5 },
        { typeKey: "gen",  authorEmail: "sysadmin@seinfeld.com", title: "Resources thread — share what's helped you",   body: "Share a book, podcast, app, or practitioner that's made a difference in your wellness journey. Let's build a resource list together.", daysAgo: 2 },
      ],
      "My Test Bubble nRgP": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Saturday run: Crissy Field to the bridge",     body: "This Saturday we're running the full waterfront route from Crissy Field to the Golden Gate overlook. About 5 miles round trip. Split into pace groups at the start.", isPinned: true, daysAgo: 7 },
        { typeKey: "gen",  authorEmail: "jerry@seinfeld.com",    title: "Fueling strategy for longer runs?",            body: "Starting to feel the bonk around mile 8. What are people using for fuel? Gels, dates, something else? Looking for real-food options if possible.", daysAgo: 4 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Sunday long run — pace groups confirmed",      body: "Sunday we have three groups: easy (11+ min/mi), moderate (9–10 min/mi), and fast (sub-9). Start together, split at the first mile marker.", daysAgo: 2 },
      ],
      "Larry Bubble": [
        { typeKey: "ann",  authorEmail: "larry@seinfeld.com",    title: "Tuesday activity: tennis at GG Park",          body: "This Tuesday we're doing tennis at Golden Gate Park courts. Intermediate level. I've booked two courts. Bring a racket and one can of balls.", isPinned: true, daysAgo: 9 },
        { typeKey: "gen",  authorEmail: "larry@seinfeld.com",    title: "Thursday TBD — suggestions welcome",           body: "Haven't decided Thursday yet. Open to basketball, bowling, or something new. Drop your vote below. Majority wins. I reserve the right to veto bowling.", daysAgo: 5 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Reminder: cancel 24 hours ahead",             body: "If you RSVP and can't make it, cancel at least 24 hours in advance. Last minute no-shows throw off the court booking. Thanks everyone.", daysAgo: 2 },
      ],
      "foo ar": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Tuesday: trying something completely different", body: "This Tuesday we're doing an urban orienteering challenge around SoMa. No experience needed. Start at the usual spot. Dress to move.", isPinned: true, daysAgo: 8 },
        { typeKey: "gen",  authorEmail: "frank@seinfeld.com",    title: "Wildest activity suggestion thread",            body: "What's something you've always wanted to try as a group but thought was too weird? Drop it here. We'll actually vote on it.", daysAgo: 4 },
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Friday location: outdoor venue in the Presidio", body: "Friday session is moving to a Presidio field. Exact location sent to confirmed RSVPs only. Expect to be outside and active for 2 hours.", daysAgo: 2 },
      ],
      "Testing": [
        { typeKey: "ann",  authorEmail: "sysadmin@seinfeld.com", title: "Bulletin board seeding test — all systems go", body: "This is a seeded announcement for testing the bulletin board feature. Notifications, reactions, and reply counts should all work from this post.", isPinned: true, daysAgo: 7 },
        { typeKey: "gen",  authorEmail: "george@seinfeld.com",   title: "Test general post — reply flow check",         body: "Testing the reply thread on a general post. If you're reading this, the board is rendering correctly. Feel free to leave a test reaction.", daysAgo: 3 },
        { typeKey: "help", authorEmail: "kramer@seinfeld.com",   title: "Help post test — is this rendering?",          body: "This is a help post to verify the help_exchange post type renders with the correct color and badge. Looks green? Great.", daysAgo: 1 },
      ],
    };

    const typeIdByKey = { ann: annType, gen: genType, help: helpType ?? genType };

    let boardsSeeded = 0;
    let postsSeeded = 0;

    for (const bc of BUBBLE_CONFIGS) {
      const bubbleId = bubbleMap[bc.title];
      if (!bubbleId) continue;

      const postDefs = BULLETIN_POSTS[bc.title];
      if (!postDefs) continue;

      try {
        // Get or create the bulletin board for this bubble.
        const existingBoards = await db
          .select({ id: bulletinBoards.id })
          .from(bulletinBoards)
          .where(eq(bulletinBoards.bubbleId, bubbleId))
          .limit(1);

        let boardId: string;
        if (existingBoards.length > 0) {
          boardId = existingBoards[0].id;
        } else {
          const [newBoard] = await db
            .insert(bulletinBoards)
            .values({ bubbleId, createdBy: sysAdminId, updatedBy: sysAdminId })
            .returning({ id: bulletinBoards.id });
          boardId = newBoard.id;
          boardsSeeded++;
        }

        // Check existing post count — skip if already populated.
        const existingPosts = await db
          .select({ id: bulletinPosts.id })
          .from(bulletinPosts)
          .where(eq(bulletinPosts.boardId, boardId));

        if (existingPosts.length >= 2) {
          console.log(`${LOG} "${bc.title}" board already has ${existingPosts.length} posts — skipping`);
          continue;
        }

        const matrix = MEMBERSHIP_MATRIX[bc.title];
        const adminEmails = matrix?.admins ?? [sysAdminId];

        for (const def of postDefs) {
          // Resolve author: prefer specified email, fall back to first admin.
          const authorId = userMap[def.authorEmail] ?? userMap[adminEmails[0]] ?? sysAdminId;
          const typeId = typeIdByKey[def.typeKey];
          const createdAt = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);

          await db.insert(bulletinPosts).values({
            boardId,
            postTypeId: typeId,
            authorId,
            title: def.title,
            body: def.body,
            isPinned: def.isPinned ?? false,
            createdBy: authorId,
            updatedBy: authorId,
            createdAt,
            updatedAt: createdAt,
          });
          postsSeeded++;
        }

        console.log(`${LOG} "${bc.title}": seeded ${postDefs.length} post(s)`);
      } catch (e) {
        console.error(`${LOG} Failed bulletin posts for "${bc.title}":`, e);
      }
    }

    console.log(`${LOG} Bulletin boards: ${boardsSeeded} created; posts: ${postsSeeded} inserted`);
  }

  // ── Step 6.5: Bulletin Board Replies ─────────────────────────────────────
  // Seed 1–3 realistic replies per post to make boards feel active.
  // Idempotent: skips any post that already has ≥ 1 reply.
  console.log(`${LOG} ── Step 6.5: seeding bulletin board replies ──`);

  type ReplyDef = { authorEmail: string; body: string; hoursAfterPost?: number };
  // Keys: bubble title → post title → reply array
  const BULLETIN_REPLIES: Record<string, Record<string, ReplyDef[]>> = {
    "Basketball": {
      "Season kick-off — Monday at Dolores!": [
        { authorEmail: "george@seinfeld.com", body: "Monday works. Will we have enough for full-court or are we splitting into half-court runs?", hoursAfterPost: 3 },
        { authorEmail: "peterman@seinfeld.com", body: "First session back is always the best. I'll be there early to warm up the court.", hoursAfterPost: 6 },
      ],
      "Who's bringing a ball this Wednesday?": [
        { authorEmail: "elaine@seinfeld.com", body: "I've got one. A little flat but I can pump it up before we start.", hoursAfterPost: 2 },
        { authorEmail: "george@seinfeld.com", body: "I'll bring mine too. Better to have two than fight over one with 10 people.", hoursAfterPost: 5 },
      ],
      "3-on-3 tournament — sign up by Friday": [
        { authorEmail: "george@seinfeld.com", body: "I'm in. Any chance we can seed teams by skill so it's not a blowout in round one?", hoursAfterPost: 4 },
        { authorEmail: "elaine@seinfeld.com", body: "Count me in. Should we do a group chat for team coordination once the bracket is set?", hoursAfterPost: 8 },
      ],
      "Best warmup before pickup?": [
        { authorEmail: "frank@seinfeld.com", body: "Ten minutes of jump rope and dynamic stretches — hamstrings, hip circles, high knees. Never rolled an ankle since I started.", hoursAfterPost: 3 },
        { authorEmail: "peterman@seinfeld.com", body: "I do a short jog to the court then two laps around the half-court line. Simple but it works.", hoursAfterPost: 7 },
      ],
    },
    "Tennis": {
      "Court resurfacing done — we're back!": [
        { authorEmail: "george@seinfeld.com", body: "Finally. The old surface was basically sandpaper. Looking forward to a proper bounce.", hoursAfterPost: 4 },
        { authorEmail: "jerry@seinfeld.com", body: "I'll be there Thursday. Same time as usual?", hoursAfterPost: 9 },
      ],
      "Looking for a hitting partner Tuesdays": [
        { authorEmail: "george@seinfeld.com", body: "I can do 8:30. Bring your own balls — I'll cover the other can.", hoursAfterPost: 3 },
        { authorEmail: "peterman@seinfeld.com", body: "I might join if I can get there in time. Is the gate open before 9?", hoursAfterPost: 7 },
      ],
      "Thursday session: doubles format this week": [
        { authorEmail: "elaine@seinfeld.com", body: "I'd prefer to partner with someone around my level. Can we try to balance the pairs?", hoursAfterPost: 2 },
        { authorEmail: "george@seinfeld.com", body: "I'm flexible on partners. Happy to fill whatever spot is needed.", hoursAfterPost: 5 },
      ],
    },
    "Cricket": {
      "Format vote — tape-ball or hardball this Sat?": [
        { authorEmail: "newman@seinfeld.com", body: "Hardball if we've got enough helmets. Otherwise tape-ball is still a good match.", hoursAfterPost: 4 },
        { authorEmail: "kramer@seinfeld.com", body: "Tape-ball is faster to set up and easier on the outfield. My vote.", hoursAfterPost: 9 },
      ],
      "Anyone have a spare bat for Sunday?": [
        { authorEmail: "larry@seinfeld.com", body: "I have a Gray-Nicolls in my car. It's a bit heavy but it's solid. Happy to bring it.", hoursAfterPost: 5 },
      ],
      "Park permit confirmed through June": [
        { authorEmail: "kramer@seinfeld.com", body: "Great news. I was worried we'd lose the field again. Let's make sure turnout stays strong.", hoursAfterPost: 3 },
        { authorEmail: "estelle@seinfeld.com", body: "Appreciate you handling the permit. One less thing to stress about.", hoursAfterPost: 8 },
      ],
    },
    "Soccer": {
      "Turf rules reminder — no slide tackles": [
        { authorEmail: "jerry@seinfeld.com", body: "Completely fair. One bad slide and someone's out for weeks. Not worth it.", hoursAfterPost: 3 },
        { authorEmail: "frank@seinfeld.com", body: "Understood. What about shoulder-to-shoulder challenges? Those still okay?", hoursAfterPost: 7 },
      ],
      "7-a-side this Monday if we hit 14 RSVP": [
        { authorEmail: "jerry@seinfeld.com", body: "I'm confirmed. Bringing a friend who played college intramurals — hope that's okay.", hoursAfterPost: 2 },
        { authorEmail: "frank@seinfeld.com", body: "In. I'll post it in the neighborhood group to get the last three spots filled.", hoursAfterPost: 6 },
      ],
      "New sub rotation — read before Wednesday": [
        { authorEmail: "newman@seinfeld.com", body: "10-minute rotations work for me. Keeps the legs fresher and cuts down on the arguing.", hoursAfterPost: 4 },
        { authorEmail: "jerry@seinfeld.com", body: "Good call. The old system was chaos in the second half.", hoursAfterPost: 10 },
      ],
    },
    "Tennis Circle": {
      "Level reminder — intermediate+ only": [
        { authorEmail: "george@seinfeld.com", body: "Agreed. It's not about being exclusionary — the flow just breaks down when there's too wide a skill gap.", hoursAfterPost: 3 },
        { authorEmail: "frank@seinfeld.com", body: "Maybe we add a beginner session one Sunday a month? That way the door is open without disrupting our regular sessions.", hoursAfterPost: 7 },
      ],
      "Bring two cans per session — new policy": [
        { authorEmail: "frank@seinfeld.com", body: "Makes sense. Pressure balls make such a difference in feel. I'll start stocking up.", hoursAfterPost: 4 },
        { authorEmail: "kramer@seinfeld.com", body: "Two cans is easy. Thanks for making this official.", hoursAfterPost: 9 },
      ],
      "Anyone up for extra drilling Sunday AM?": [
        { authorEmail: "george@seinfeld.com", body: "I'm in. I need to work on my return game anyway. What time were you thinking?", hoursAfterPost: 5 },
        { authorEmail: "kramer@seinfeld.com", body: "Would love to if you do it before noon. What court are you booking?", hoursAfterPost: 11 },
      ],
    },
    "SF Pickleball Crew": {
      "Noe Valley courts confirmed both days!": [
        { authorEmail: "jerry@seinfeld.com", body: "Perfect. Saturday works better for me. Will there be loaner paddles for anyone who doesn't have their own?", hoursAfterPost: 4 },
        { authorEmail: "estelle@seinfeld.com", body: "Great news. I'll spread the word to a couple people who asked about coming.", hoursAfterPost: 8 },
      ],
      "Paddle recommendations for beginners?": [
        { authorEmail: "elaine@seinfeld.com", body: "The Engage Poach Advantage is around $50 and really forgiving for beginners. A friend started with it and still uses it.", hoursAfterPost: 3 },
        { authorEmail: "estelle@seinfeld.com", body: "I started with a Selkirk Latitude. It's lightweight and easy to control. Good first paddle.", hoursAfterPost: 7 },
      ],
      "Beginner-friendly rotation this Sunday": [
        { authorEmail: "jerry@seinfeld.com", body: "Love this. I have two friends who've been wanting to try. Mind if I bring them?", hoursAfterPost: 2 },
        { authorEmail: "elaine@seinfeld.com", body: "Good move. Growing the group is worth a slightly slower Sunday now and then.", hoursAfterPost: 6 },
      ],
    },
    "Campus hoops": {
      "SFSU gym check-in policy updated": [
        { authorEmail: "larry@seinfeld.com", body: "Got it. Will leave my ID in my bag from now on. Thanks for the heads up.", hoursAfterPost: 3 },
        { authorEmail: "george@seinfeld.com", body: "Any chance student IDs count or does it have to be government-issued?", hoursAfterPost: 7 },
      ],
      "Dunking ban — who actually reads the rules?": [
        { authorEmail: "george@seinfeld.com", body: "Hard to resist when you're in the zone but losing the court would be much worse. Message received.", hoursAfterPost: 4 },
        { authorEmail: "frank@seinfeld.com", body: "Worth posting a sign near the rim so new people know before they try something.", hoursAfterPost: 9 },
      ],
      "Wednesday is packed — arrive early": [
        { authorEmail: "larry@seinfeld.com", body: "5:45 noted. I've been showing up at 6:15 and waiting forever. Won't happen again.", hoursAfterPost: 5 },
        { authorEmail: "george@seinfeld.com", body: "22 people is wild. Is there a way to cap RSVPs so it doesn't get that crowded?", hoursAfterPost: 10 },
      ],
    },
    "Billiards": {
      "Slate Billiards: table reservation confirmed": [
        { authorEmail: "george@seinfeld.com", body: "Four tables is plenty. Much better than scrambling for open spots like last month.", hoursAfterPost: 4 },
        { authorEmail: "frank@seinfeld.com", body: "This is great. I'll start telling people to check in under the group name so the staff stays familiar with us.", hoursAfterPost: 9 },
      ],
      "9-ball bracket idea — thoughts?": [
        { authorEmail: "frank@seinfeld.com", body: "I'm for it. 9-ball moves faster than 8-ball anyway. One night of experimenting won't hurt.", hoursAfterPost: 4 },
        { authorEmail: "elaine@seinfeld.com", body: "Open to it. I'd want a quick rules refresher since I mostly play 8-ball, but I'm in.", hoursAfterPost: 8 },
      ],
      "Table etiquette reminder": [
        { authorEmail: "george@seinfeld.com", body: "Guilty of assuming once. I'll always ask now. Good reminder.", hoursAfterPost: 3 },
        { authorEmail: "elaine@seinfeld.com", body: "This is basic courtesy. Should just be obvious, but apparently it needs saying.", hoursAfterPost: 6 },
      ],
    },
    "Karting": {
      "Sign your waiver before you arrive!": [
        { authorEmail: "peterman@seinfeld.com", body: "Signed mine last night. Takes two minutes. Everyone else do it now so we start on time.", hoursAfterPost: 5 },
        { authorEmail: "newman@seinfeld.com", body: "Done. Also downloaded the K1 app — apparently you can track your session times there.", hoursAfterPost: 10 },
      ],
      "Saturday lap records — who's on top?": [
        { authorEmail: "newman@seinfeld.com", body: "28.4 is fast. My best was 29.1 last session. Still working out the braking point on the hairpin.", hoursAfterPost: 5 },
      ],
      "Group discount unlocked — 8+ confirmed": [
        { authorEmail: "peterman@seinfeld.com", body: "Eight dollars back per person adds up nicely. Well done on getting us to the threshold.", hoursAfterPost: 3 },
        { authorEmail: "newman@seinfeld.com", body: "RSVPed. Make sure people don't bail last minute or we might lose the rate.", hoursAfterPost: 7 },
      ],
    },
    "ABC Farm": {
      "Spring planting has started — all hands!": [
        { authorEmail: "kramer@seinfeld.com", body: "I'll be there Saturday morning. Should we bring our own trowels or does the farm have tools?", hoursAfterPost: 4 },
        { authorEmail: "newman@seinfeld.com", body: "Excited for the tomatoes. Last year's were incredible. I'll be there with my gloves.", hoursAfterPost: 9 },
      ],
      "Gloves needed — anyone have extras?": [
        { authorEmail: "newman@seinfeld.com", body: "I have an extra medium pair that I barely use. Will bring them Saturday.", hoursAfterPost: 3 },
        { authorEmail: "elaine@seinfeld.com", body: "I'll grab a cheap pair from the hardware store on the way. Better to have spares.", hoursAfterPost: 6 },
      ],
      "First harvest share next Sunday!": [
        { authorEmail: "kramer@seinfeld.com", body: "This is the best part of the season. Bringing a big bag. Lettuce and radishes sound perfect.", hoursAfterPost: 4 },
        { authorEmail: "newman@seinfeld.com", body: "I've been there every weekend this month so I'm looking forward to actually eating some of what we grew.", hoursAfterPost: 8 },
      ],
      "Anyone know how to fix a drip irrigator?": [
        { authorEmail: "kramer@seinfeld.com", body: "Sounds like the ferrule fitting is cracked. A compression coupling from the hardware store should fix it — around $2.", hoursAfterPost: 2 },
        { authorEmail: "elaine@seinfeld.com", body: "Kramer's right. I've patched those before. Come early Saturday and we can take a look together.", hoursAfterPost: 5 },
      ],
    },
    "Bark at Dogpatch": {
      "Vaccination reminder — required to join!": [
        { authorEmail: "jerry@seinfeld.com", body: "My dog is up to date on everything. Happy to share the vet records digitally if it helps streamline check-in.", hoursAfterPost: 5 },
        { authorEmail: "kramer@seinfeld.com", body: "Good reminder. Some people bring dogs assuming it's fine. Appreciate you enforcing this.", hoursAfterPost: 10 },
      ],
      "Any reactive dogs coming Saturday?": [
        { authorEmail: "kramer@seinfeld.com", body: "Mine can be selective too. Arriving late sounds like a good call — I'll plan the same if my dog is having an off day.", hoursAfterPost: 4 },
      ],
      "New off-leash rules at Esprit — read this": [
        { authorEmail: "jerry@seinfeld.com", body: "Good to know. I've seen people letting their dogs off-leash at the entrance. I'll say something next time.", hoursAfterPost: 4 },
        { authorEmail: "kramer@seinfeld.com", body: "City patrol on weekends is no joke. Let's not risk the group getting flagged.", hoursAfterPost: 9 },
      ],
    },
    "Corgi Farm": {
      "Corgi Farm Saturday: potluck theme is brunch": [
        { authorEmail: "estelle@seinfeld.com", body: "I'll bring a frittata — easy to slice and share. Do we need to coordinate to avoid doubles?", hoursAfterPost: 4 },
        { authorEmail: "frank@seinfeld.com", body: "Bringing overnight oats with berries and some mini croissants from the bakery on Valencia.", hoursAfterPost: 9 },
      ],
      "My corgi just turned 2 — mini celebration?": [
        { authorEmail: "jerry@seinfeld.com", body: "Happy birthday Bagelach! My corgi will absolutely be her hype dog. We'll be there.", hoursAfterPost: 3 },
        { authorEmail: "frank@seinfeld.com", body: "Dog-safe cake sounds amazing. What's it made from? My guy has a wheat allergy.", hoursAfterPost: 7 },
      ],
      "Reminder: leashes until the open area": [
        { authorEmail: "estelle@seinfeld.com", body: "My neighbor's corgi bolted into the cafe last time. This reminder is very much needed.", hoursAfterPost: 4 },
        { authorEmail: "jerry@seinfeld.com", body: "Will do. My pup is leashed until we hit the courtyard anyway — she learned her lesson.", hoursAfterPost: 8 },
      ],
    },
    "Mexican food": {
      "This Friday: La Taqueria on Mission": [
        { authorEmail: "george@seinfeld.com", body: "I'm in. Should we show up all at once or trickle in and grab tables as they open?", hoursAfterPost: 3 },
        { authorEmail: "kramer@seinfeld.com", body: "La Taqueria is the right call. Best carnitas in the city, no question.", hoursAfterPost: 7 },
      ],
      "Best Oaxacan spot in the Mission?": [
        { authorEmail: "kramer@seinfeld.com", body: "Taqueria Cancun is solid but it's more Jalisco-style. For real Oaxacan, try Tlayuda on 24th — mole is outstanding.", hoursAfterPost: 4 },
        { authorEmail: "elaine@seinfeld.com", body: "Seconding Tlayuda. The tlayuda with black beans and quesillo is worth the trip.", hoursAfterPost: 9 },
      ],
      "Saturday: street food tour route published": [
        { authorEmail: "george@seinfeld.com", body: "Route looks great. Pacing 4 stops over 2 hours is ambitious but doable if we keep moving.", hoursAfterPost: 3 },
        { authorEmail: "kramer@seinfeld.com", body: "I've already got my $30 in cash. Ready.", hoursAfterPost: 7 },
      ],
      "Tamale recommendation — El Buen Sabor": [
        { authorEmail: "george@seinfeld.com", body: "I walked past that place last week. Good to know it's worth going in. Will try it this weekend.", hoursAfterPost: 3 },
        { authorEmail: "elaine@seinfeld.com", body: "Noted. The pork tamales or the sweet ones?", hoursAfterPost: 6 },
      ],
    },
    "Mexican Food Truck": {
      "Location unlocked — this Wednesday's truck": [
        { authorEmail: "elaine@seinfeld.com", body: "Perfect. I know exactly where Capp and 22nd is. Will carpool from SoMa StrEat — anyone want to join?", hoursAfterPost: 4 },
        { authorEmail: "frank@seinfeld.com", body: "The carpool idea is smart. Parking in that area is brutal on Wednesday nights.", hoursAfterPost: 8 },
      ],
      "Best fish taco truck in the city — debate": [
        { authorEmail: "newman@seinfeld.com", body: "Gordo Taqueria on Judah. Not a truck technically but the fish taco is better than anything on wheels.", hoursAfterPost: 3 },
        { authorEmail: "frank@seinfeld.com", body: "The Daly City truck is called El Paisa and it's genuinely good. Worth making the trip.", hoursAfterPost: 7 },
      ],
      "New truck map updated — 7 spots added": [
        { authorEmail: "elaine@seinfeld.com", body: "Got the link. Three of those spots are new to me. Looking forward to working through them.", hoursAfterPost: 5 },
        { authorEmail: "newman@seinfeld.com", body: "Appreciate you keeping this internal. No one wants these spots to blow up.", hoursAfterPost: 10 },
      ],
    },
    "Mindful Mamas": {
      "Monday Walk: Bernal Heights loop route": [
        { authorEmail: "elaine@seinfeld.com", body: "I'll be there with the stroller. Is the path paved all the way up or does it get rough near the top?", hoursAfterPost: 4 },
      ],
      "Wednesday: guided meditation, 20 min": [
        { authorEmail: "sysadmin@seinfeld.com", body: "Twenty minutes is very approachable. Can't wait to try this — will bring a mat.", hoursAfterPost: 5 },
      ],
      "Resources thread — share what's helped you": [
        { authorEmail: "elaine@seinfeld.com", body: "The book 'Burnout' by Emily and Amelia Nagoski changed how I think about stress and rest. Highly recommend.", hoursAfterPost: 4 },
      ],
    },
    "My Test Bubble nRgP": {
      "Saturday run: Crissy Field to the bridge": [
        { authorEmail: "jerry@seinfeld.com", body: "I'll be in the moderate pace group. Anyone else aiming for the 9–10 min/mi range?", hoursAfterPost: 4 },
        { authorEmail: "elaine@seinfeld.com", body: "That route is beautiful on a clear morning. Fingers crossed the fog stays off.", hoursAfterPost: 9 },
      ],
      "Fueling strategy for longer runs?": [
        { authorEmail: "larry@seinfeld.com", body: "I switched to medjool dates around mile 6 and the bonk disappeared. Takes a bit to digest but works great for me.", hoursAfterPost: 3 },
        { authorEmail: "elaine@seinfeld.com", body: "Banana and peanut butter before the run, gel at mile 7. Two things, works every time.", hoursAfterPost: 7 },
      ],
      "Sunday long run — pace groups confirmed": [
        { authorEmail: "jerry@seinfeld.com", body: "Moderate group for me. I'll be at the start line at the first mile marker. See you there.", hoursAfterPost: 5 },
        { authorEmail: "estelle@seinfeld.com", body: "Easy group this week — my legs are still recovering from Thursday. Thanks for organizing this.", hoursAfterPost: 10 },
      ],
    },
    "Larry Bubble": {
      "Tuesday activity: tennis at GG Park": [
        { authorEmail: "george@seinfeld.com", body: "Two courts is plenty. Should we bring extra balls in case someone doesn't have a can?", hoursAfterPost: 4 },
        { authorEmail: "kramer@seinfeld.com", body: "GG Park courts are great. I'll bring a can and a backup racket in case someone needs to borrow.", hoursAfterPost: 9 },
      ],
      "Thursday TBD — suggestions welcome": [
        { authorEmail: "george@seinfeld.com", body: "Basketball. Always basketball. Golden Gate Park courts on Fulton if the weather's good.", hoursAfterPost: 3 },
        { authorEmail: "elaine@seinfeld.com", body: "Bowling is underrated. Have you been to Presidio Bowl? It's weirdly great.", hoursAfterPost: 7 },
      ],
      "Reminder: cancel 24 hours ahead": [
        { authorEmail: "george@seinfeld.com", body: "Noted. I'll set a reminder the day before any event I RSVP to.", hoursAfterPost: 4 },
        { authorEmail: "kramer@seinfeld.com", body: "Fair rule. Court bookings are hard enough to get without last-minute gaps messing up the count.", hoursAfterPost: 9 },
      ],
    },
    "foo ar": {
      "Tuesday: trying something completely different": [
        { authorEmail: "frank@seinfeld.com", body: "Orienteering in SoMa sounds genuinely interesting. Do we need to download an app beforehand?", hoursAfterPost: 5 },
        { authorEmail: "newman@seinfeld.com", body: "I've never done this. Looking forward to being completely lost for 90 minutes.", hoursAfterPost: 10 },
      ],
      "Wildest activity suggestion thread": [
        { authorEmail: "larry@seinfeld.com", body: "Urban archery range. There's one in Hunters Point. Strange enough that I think we'd love it.", hoursAfterPost: 4 },
        { authorEmail: "jerry@seinfeld.com", body: "Improv comedy class. One session. Nobody has to be funny — that's kind of the point.", hoursAfterPost: 8 },
      ],
      "Friday location: outdoor venue in the Presidio": [
        { authorEmail: "frank@seinfeld.com", body: "RSVPed. I'll park on the Lincoln side and walk in from there. See you at the field.", hoursAfterPost: 3 },
        { authorEmail: "newman@seinfeld.com", body: "The Presidio in the evening is gorgeous. Good pick for a Friday session.", hoursAfterPost: 7 },
      ],
    },
    "Testing": {
      "Bulletin board seeding test — all systems go": [
        { authorEmail: "george@seinfeld.com", body: "Seeing this fine on my end. Announcement badge, pinned indicator, and reply count all showing correctly.", hoursAfterPost: 3 },
        { authorEmail: "kramer@seinfeld.com", body: "Looks good on my screen too. Ready for the next round of testing.", hoursAfterPost: 7 },
      ],
      "Test general post — reply flow check": [
        { authorEmail: "newman@seinfeld.com", body: "Reply loaded correctly with the right author avatar and timestamp. Thread is working.", hoursAfterPost: 4 },
        { authorEmail: "jerry@seinfeld.com", body: "Confirmed on my device as well. Reply count increments immediately after posting.", hoursAfterPost: 9 },
      ],
      "Help post test — is this rendering?": [
        { authorEmail: "george@seinfeld.com", body: "Green badge is showing and the help_exchange label is correct. Looks like it's working.", hoursAfterPost: 5 },
      ],
    },
  };

  let repliesSeeded = 0;

  for (const bc of BUBBLE_CONFIGS) {
    const bubbleId = bubbleMap[bc.title];
    if (!bubbleId) continue;

    const replyMap = BULLETIN_REPLIES[bc.title];
    if (!replyMap) continue;

    try {
      const existingBoards = await db
        .select({ id: bulletinBoards.id })
        .from(bulletinBoards)
        .where(eq(bulletinBoards.bubbleId, bubbleId))
        .limit(1);

      if (existingBoards.length === 0) continue;
      const boardId = existingBoards[0].id;

      const posts = await db
        .select({ id: bulletinPosts.id, title: bulletinPosts.title, createdAt: bulletinPosts.createdAt })
        .from(bulletinPosts)
        .where(eq(bulletinPosts.boardId, boardId));

      for (const post of posts) {
        const replyDefs = replyMap[post.title];
        if (!replyDefs || replyDefs.length === 0) continue;

        // Idempotency: skip if this post already has replies.
        const existing = await db
          .select({ id: bulletinReplies.id })
          .from(bulletinReplies)
          .where(eq(bulletinReplies.postId, post.id))
          .limit(1);

        if (existing.length > 0) continue;

        for (let i = 0; i < replyDefs.length; i++) {
          const def = replyDefs[i];
          const authorId = userMap[def.authorEmail] ?? sysAdminId;
          const hoursAfter = def.hoursAfterPost ?? (i + 1) * 3;
          const createdAt = new Date(post.createdAt.getTime() + hoursAfter * 60 * 60 * 1000);

          await db.insert(bulletinReplies).values({
            postId: post.id,
            authorId,
            body: def.body,
            createdBy: authorId,
            updatedBy: authorId,
            createdAt,
            updatedAt: createdAt,
          });
          repliesSeeded++;
        }
      }

      console.log(`${LOG} "${bc.title}": replies seeded`);
    } catch (e) {
      console.error(`${LOG} Failed bulletin replies for "${bc.title}":`, e);
    }
  }

  console.log(`${LOG} Bulletin replies: ${repliesSeeded} inserted`);

  // ── Step 6b: Bulletin Board Post Reactions ────────────────────────────────
  // For each seeded post, add 1–4 heart reactions from bubble members.
  // Idempotent: skips any post that already has at least one reaction.
  console.log(`${LOG} ── Step 6b: seeding bulletin post reactions ──`);

  for (const bc of BUBBLE_CONFIGS) {
    const bubbleId = bubbleMap[bc.title];
    if (!bubbleId) continue;

    const matrix = MEMBERSHIP_MATRIX[bc.title];
    if (!matrix) continue;

    const allEmails = [...matrix.admins, ...matrix.members];
    const memberIds = allEmails.map(e => userMap[e]).filter(Boolean) as string[];
    if (memberIds.length === 0) continue;

    try {
      // Find the board for this bubble.
      const boardRows = await db
        .select({ id: bulletinBoards.id })
        .from(bulletinBoards)
        .where(eq(bulletinBoards.bubbleId, bubbleId))
        .limit(1);
      if (boardRows.length === 0) continue;
      const boardId = boardRows[0].id;

      // Fetch all posts for this board.
      const postRows = await db
        .select({ id: bulletinPosts.id })
        .from(bulletinPosts)
        .where(eq(bulletinPosts.boardId, boardId));
      if (postRows.length === 0) continue;

      let totalAdded = 0;
      let postsSkipped = 0;

      for (const post of postRows) {
        // Check if this post already has any reactions — skip if so.
        const existing = await db
          .select({ id: bulletinPostReactions.id })
          .from(bulletinPostReactions)
          .where(eq(bulletinPostReactions.postId, post.id))
          .limit(1);
        if (existing.length > 0) { postsSkipped++; continue; }

        // Deterministically pick 1–4 reactors using the post id as a seed.
        const hash = post.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const count = 1 + (hash % Math.min(4, memberIds.length));
        const offset = hash % memberIds.length;
        const rotated = [...memberIds.slice(offset), ...memberIds.slice(0, offset)];
        const picks = rotated.slice(0, count);

        for (const userId of picks) {
          await db.insert(bulletinPostReactions).values({
            postId: post.id,
            userId,
            emoji: "heart",
          });
          totalAdded++;
        }
      }

      console.log(`${LOG} "${bc.title}": ${postRows.length} post(s) scanned, ${postsSkipped} skipped, ${totalAdded} heart reaction(s) added`);
    } catch (e) {
      console.error(`${LOG} Failed reactions for "${bc.title}":`, e);
    }
  }

  // ── Step 7: Fix unreliable cover image URLs ───────────────────────────────
  // Clear any cover_image values that are not stored in object storage
  // (e.g. Google Share links, newspaper websites, or other third-party URLs).
  // seed-bubble-images will then re-upload the correct images from Unsplash.
  try {
    const allBubbles = await db
      .select({ id: bubbles.id, title: bubbles.title, coverImage: bubbles.coverImage })
      .from(bubbles);

    const badUrls = allBubbles.filter(
      b => b.coverImage && !b.coverImage.includes("/objects/uploads/")
    );

    if (badUrls.length > 0) {
      await db
        .update(bubbles)
        .set({ coverImage: null })
        .where(inArray(bubbles.id, badUrls.map(b => b.id)));
      console.log(
        `${LOG} Cleared ${badUrls.length} unreliable cover image URL(s): ` +
        badUrls.map(b => `"${b.title}"`).join(", ")
      );
    }
  } catch (e) {
    console.error(`${LOG} Failed to patch bad cover image URLs:`, e);
  }

  // ── Step 8: Seed bubble + event cover images from Unsplash ────────────────
  try {
    await seedBubbleImages();
  } catch (e) {
    console.error(`${LOG} seedBubbleImages failed:`, e);
  }

  console.log(`${LOG} ===== Staging seed complete! =====`);
}
