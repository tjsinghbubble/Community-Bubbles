import { db } from "./db";
import { storage } from "./storage";
import { bubbles, memberships, events, users, eventAttendees } from "@shared/schema";
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

  // ── Step 6: Fix unreliable cover image URLs ───────────────────────────────
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

  // ── Step 7: Seed bubble + event cover images from Unsplash ────────────────
  try {
    await seedBubbleImages();
  } catch (e) {
    console.error(`${LOG} seedBubbleImages failed:`, e);
  }

  console.log(`${LOG} ===== Staging seed complete! =====`);
}
