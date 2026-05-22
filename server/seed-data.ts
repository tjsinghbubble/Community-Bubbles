import { db } from "./db";
import { users, bubbles, memberships, bulletinBoards, bulletinPosts, bulletinPostTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const defaultPassword = "Bubble123!";

const seedUsers = [
  { name: "Alex Rivera", email: "alex@bubble.test", interests: ["Hiking", "Photography", "Coffee Meetups"] },
  { name: "Jordan Lee", email: "jordan@bubble.test", interests: ["Yoga", "Book Clubs", "Cooking"] },
  { name: "Sam Patel", email: "sam@bubble.test", interests: ["Running", "Tech Meetups", "Board Games"] },
  { name: "Morgan Chen", email: "morgan@bubble.test", interests: ["Cycling", "Arts & Crafts", "Volunteering"] },
  { name: "Taylor Kim", email: "taylor@bubble.test", interests: ["Fitness Classes", "Dining Out", "Music"] },
  { name: "Casey Brooks", email: "casey@bubble.test", interests: ["Pickleball", "Gardening", "Brunch"] },
  { name: "Riley Nguyen", email: "riley@bubble.test", interests: ["Dance", "Photography", "Travel & Exploration"] },
  { name: "Jamie Ortiz", email: "jamie@bubble.test", interests: ["Tennis", "Professional Networking", "Wine & Spirits"] },
  { name: "Drew Martinez", email: "drew@bubble.test", interests: ["Team Sports", "Camping & Backpacking", "Startup & Founders"] },
  { name: "Quinn Davis", email: "quinn@bubble.test", interests: ["Wellness", "Pets", "Neighborhood Groups"] },
  { name: "Avery Thompson", email: "avery@bubble.test", interests: ["Running", "Coffee Meetups", "Book Clubs"] },
  { name: "Dakota Wilson", email: "dakota@bubble.test", interests: ["Hiking", "Farmers Markets", "Volunteering"] },
];

const seedBubbles = [
  {
    title: "Morning Trail Runners",
    tagline: "Hit the trails before sunrise",
    category: "Running",
    description: "A group for early-bird trail runners who love exploring local paths and parks. All paces welcome — we run together, not against each other.",
    rules: ["Be respectful of all fitness levels", "Show up on time", "Stay on marked trails"],
    privacy: "Public",
    locationName: "Town Lake Trail",
    locationAddress: "Austin, TX",
  },
  {
    title: "Shutter Society",
    tagline: "Capture the world one frame at a time",
    category: "Photography",
    description: "For hobbyist and aspiring photographers who want to explore different styles, share tips, and go on photo walks together around the city.",
    rules: ["Give constructive feedback only", "Ask before photographing people", "Share your best shots"],
    privacy: "Public",
    locationName: "Downtown Arts District",
    locationAddress: "Dallas, TX",
  },
  {
    title: "Page Turners Book Club",
    tagline: "Great stories, better conversations",
    category: "Book Clubs",
    description: "We read one book a month across different genres and meet to discuss over coffee. Fiction, non-fiction, memoirs — we cover it all.",
    rules: ["No spoilers outside meetings", "Respect differing opinions", "Try to finish the book before meetups"],
    privacy: "Public",
    locationName: "Central Library",
    locationAddress: "Houston, TX",
  },
  {
    title: "Weekend Hikers",
    tagline: "Adventure is just a trail away",
    category: "Hiking",
    description: "Weekend hiking group tackling local and regional trails. From easy scenic walks to challenging summit climbs, there is something for everyone.",
    rules: ["Pack out what you pack in", "Bring enough water", "Let someone know your plans"],
    privacy: "Request to Join",
    locationName: "Barton Creek Greenbelt",
    locationAddress: "Austin, TX",
  },
  {
    title: "Code & Coffee",
    tagline: "Debug your code, not your latte",
    category: "Tech Meetups",
    description: "Developers, designers, and tech enthusiasts gathering weekly at local cafes to work on side projects, share knowledge, and network.",
    rules: ["All skill levels welcome", "Be helpful, not condescending", "Buy something from the cafe"],
    privacy: "Public",
    locationName: "Epoch Coffee",
    locationAddress: "Austin, TX",
  },
  {
    title: "Pickleball Crew",
    tagline: "Dink, drive, dominate",
    category: "Pickleball",
    description: "Casual and competitive pickleball players meeting several times a week at local courts. Beginners and seasoned players alike are welcome.",
    rules: ["Rotate courts fairly", "Bring your own paddle", "Good sportsmanship always"],
    privacy: "Public",
    locationName: "Mueller Park Courts",
    locationAddress: "Austin, TX",
  },
];

const bubbleAnnouncements: Record<string, { admin1: { title: string; body: string }; admin2: { title: string; body: string } }> = {
  "Morning Trail Runners": {
    admin1: {
      title: "Summer Sunrise Series Starts Next Week!",
      body: "Starting next Monday, we're kicking off our Summer Sunrise Series — meet at 5:45 AM at the main trailhead for a 5K loop followed by coffee. Runs every Monday and Wednesday through the end of August. All paces welcome!",
    },
    admin2: {
      title: "Trail Cleanup Day — Volunteers Needed",
      body: "We're partnering with the parks department for a trail cleanup on the last Saturday of next month. Gloves and bags provided. Meet at Parking Lot B at 8 AM. Great way to give back to the trails we love!",
    },
  },
  "Shutter Society": {
    admin1: {
      title: "Golden Hour Photo Walk — Downtown This Saturday",
      body: "Join us for a golden hour photo walk through the arts district this Saturday at 6 PM. We'll cover street photography techniques and composition tips. Bring any camera — phones are totally fine!",
    },
    admin2: {
      title: "Monthly Photo Challenge: Reflections",
      body: "Our theme for the upcoming month is 'Reflections' — water, mirrors, glass, anything goes. Submit your best shot to the group by the last day of the month. Top 3 picks will be featured on our board!",
    },
  },
  "Page Turners Book Club": {
    admin1: {
      title: "Next Month's Pick: 'Demon Copperhead'",
      body: "Our next read is Barbara Kingsolver's Pulitzer Prize-winning 'Demon Copperhead.' Discussion meetup will be the third Thursday of next month at 7 PM at Central Library. Copies available at the front desk.",
    },
    admin2: {
      title: "Author Q&A Event Coming Up!",
      body: "Exciting news — we've arranged a virtual Q&A with a local author whose debut novel just hit shelves. Details will be shared soon, but mark your calendars for two weeks from Saturday at 3 PM.",
    },
  },
  "Weekend Hikers": {
    admin1: {
      title: "Spring Trail Guide — Top 5 Picks",
      body: "We've put together a list of the top 5 spring trails in the area, ranked by difficulty and scenery. Check the guide in the group chat. Our first group hike of the season is next Saturday at Barton Creek — RSVP in the events tab!",
    },
    admin2: {
      title: "Gear Swap Meetup Announcement",
      body: "Got hiking gear collecting dust? Bring it to our gear swap meetup happening in two weeks at Zilker Park pavilion. Boots, packs, trekking poles, hydration gear — everything's fair game. One hiker's old gear is another's treasure!",
    },
  },
  "Code & Coffee": {
    admin1: {
      title: "Hackathon Weekend — Build Something Cool",
      body: "We're hosting a casual 48-hour hackathon starting next Friday evening. No prizes, no pressure — just build something fun with fellow devs. Teams of 1-4. Sign up in the events tab to reserve your spot!",
    },
    admin2: {
      title: "Lightning Talks — Share What You Know",
      body: "Next Wednesday we're doing 5-minute lightning talks. Got a cool tool, framework, or trick? Sign up to present! Topics so far include Bun runtime, Cursor tips, and building with AI. All skill levels encouraged to participate.",
    },
  },
  "Pickleball Crew": {
    admin1: {
      title: "Court Reservations — New Schedule",
      body: "We've secured dedicated court time at Mueller Park! Tuesday and Thursday evenings 6-8 PM, and Saturday mornings 9-11 AM are now officially ours. Please arrive 10 minutes early to help set up nets.",
    },
    admin2: {
      title: "Beginner Clinic Next Sunday",
      body: "Know someone curious about pickleball? We're running a free beginner clinic next Sunday from 10 AM to noon. Paddles and balls provided. Invite your friends and family — let's grow the community!",
    },
  },
};

const memberAssignments: { bubbleIndex: number; adminIndices: number[]; memberIndices: number[] }[] = [
  { bubbleIndex: 0, adminIndices: [0, 2], memberIndices: [4, 6, 8, 10, 11] },
  { bubbleIndex: 1, adminIndices: [0, 6], memberIndices: [1, 3, 5, 7, 9] },
  { bubbleIndex: 2, adminIndices: [1, 10], memberIndices: [0, 3, 5, 7, 11] },
  { bubbleIndex: 3, adminIndices: [0, 11], memberIndices: [2, 4, 6, 8, 10] },
  { bubbleIndex: 4, adminIndices: [2, 8], memberIndices: [0, 1, 5, 7, 9] },
  { bubbleIndex: 5, adminIndices: [5, 7], memberIndices: [0, 2, 4, 8, 10] },
];

export async function seedData() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    console.log("[SEED] Data already seeded (users exist), skipping");
    return;
  }

  console.log("[SEED] Seeding users, bubbles, memberships, and announcements...");

  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const createdUsers: { id: string; name: string; email: string }[] = [];
  for (const u of seedUsers) {
    const [created] = await db.insert(users).values({
      name: u.name,
      email: u.email,
      password: hashedPassword,
      interests: u.interests,
    }).returning({ id: users.id, name: users.name, email: users.email });
    createdUsers.push(created);
  }
  console.log(`[SEED] Created ${createdUsers.length} users`);

  const createdBubbles: { id: string; title: string; createdBy: string }[] = [];
  for (let i = 0; i < seedBubbles.length; i++) {
    const b = seedBubbles[i];
    const creatorIndex = memberAssignments[i].adminIndices[0];
    const [created] = await db.insert(bubbles).values({
      title: b.title,
      tagline: b.tagline,
      category: b.category,
      description: b.description,
      rules: b.rules,
      privacy: b.privacy,
      locationName: b.locationName,
      locationAddress: b.locationAddress,
      createdBy: createdUsers[creatorIndex].id,
      status: "approved",
      members: memberAssignments[i].adminIndices.length + memberAssignments[i].memberIndices.length,
    }).returning({ id: bubbles.id, title: bubbles.title, createdBy: bubbles.createdBy });
    createdBubbles.push(created);
  }
  console.log(`[SEED] Created ${createdBubbles.length} bubbles`);

  for (let i = 0; i < createdBubbles.length; i++) {
    const bubble = createdBubbles[i];
    const assignment = memberAssignments[i];

    for (const adminIdx of assignment.adminIndices) {
      await db.insert(memberships).values({
        userId: createdUsers[adminIdx].id,
        bubbleId: bubble.id,
        role: "admin",
        membershipStatus: "approved",
        createdBy: createdUsers[adminIdx].id,
      });
    }

    for (const memberIdx of assignment.memberIndices) {
      await db.insert(memberships).values({
        userId: createdUsers[memberIdx].id,
        bubbleId: bubble.id,
        role: "member",
        membershipStatus: "approved",
        createdBy: createdUsers[memberIdx].id,
      });
    }
  }
  console.log("[SEED] Created memberships (admins + members)");

  const postTypeRows = await db.select().from(bulletinPostTypes).where(eq(bulletinPostTypes.name, "announcements"));
  if (postTypeRows.length === 0) {
    console.log("[SEED] Announcements post type not found, skipping bulletin seeding");
    return;
  }
  const announcementTypeId = postTypeRows[0].id;

  for (let i = 0; i < createdBubbles.length; i++) {
    const bubble = createdBubbles[i];
    const assignment = memberAssignments[i];
    const admin1Id = createdUsers[assignment.adminIndices[0]].id;
    const admin2Id = createdUsers[assignment.adminIndices[1]].id;

    const [board] = await db.insert(bulletinBoards).values({
      bubbleId: bubble.id,
      createdBy: admin1Id,
      updatedBy: admin1Id,
    }).returning({ id: bulletinBoards.id });

    const announcements = bubbleAnnouncements[bubble.title];
    if (announcements) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 21);

      await db.insert(bulletinPosts).values({
        boardId: board.id,
        postTypeId: announcementTypeId,
        authorId: admin1Id,
        title: announcements.admin1.title,
        body: announcements.admin1.body,
        isPinned: true,
        createdBy: admin1Id,
        updatedBy: admin1Id,
        createdAt: nextWeek,
        updatedAt: nextWeek,
      });

      await db.insert(bulletinPosts).values({
        boardId: board.id,
        postTypeId: announcementTypeId,
        authorId: admin2Id,
        title: announcements.admin2.title,
        body: announcements.admin2.body,
        isPinned: false,
        createdBy: admin2Id,
        updatedBy: admin2Id,
        createdAt: nextMonth,
        updatedAt: nextMonth,
      });
    }
  }
  console.log("[SEED] Created bulletin boards and announcements for all bubbles");

  console.log("[SEED] Data seeding complete!");
  console.log("[SEED] Login credentials: any seeded email (e.g. alex@bubble.test) with password: Bubble123!");
}
