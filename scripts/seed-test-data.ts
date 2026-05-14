import { db } from '../server/db.js';
import { users, bubbles, memberships } from '../shared/schema.js';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding test data...');

  const hashedUserPass = await bcrypt.hash('TestPass123!', 10);
  const [testUser] = await db
    .insert(users)
    .values({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedUserPass,
      interests: ['Sports', 'Music', 'Tech'],
      isSuperAdmin: false,
    })
    .returning();
  console.log(`  Created user: ${testUser.email} (id: ${testUser.id})`);

  const hashedAdminPass = await bcrypt.hash('AdminPass123!', 10);
  const [adminUser] = await db
    .insert(users)
    .values({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedAdminPass,
      interests: [],
      isSuperAdmin: true,
    })
    .returning();
  console.log(`  Created admin: ${adminUser.email} (id: ${adminUser.id})`);

  const [approvedBubble] = await db
    .insert(bubbles)
    .values({
      title: 'Weekend Hikers',
      tagline: 'Explore trails together',
      category: 'Outdoors',
      description: 'A group for outdoor enthusiasts who love hiking on weekends.',
      creatorId: testUser.id,
      status: 'approved',
      privacy: 'Public',
      rules: [],
      images: [],
      attachments: [],
    })
    .returning();
  console.log(`  Created approved bubble: "${approvedBubble.title}" (id: ${approvedBubble.id})`);

  const [pendingBubble] = await db
    .insert(bubbles)
    .values({
      title: 'Book Club',
      tagline: 'Reading and discussing great books',
      category: 'Books',
      description: 'Monthly book club for avid readers.',
      creatorId: testUser.id,
      status: 'pending',
      privacy: 'Public',
      rules: [],
      images: [],
      attachments: [],
    })
    .returning();
  console.log(`  Created pending bubble: "${pendingBubble.title}" (id: ${pendingBubble.id})`);

  await db.insert(memberships).values([
    {
      userId: testUser.id,
      bubbleId: approvedBubble.id,
      role: 'admin',
      membershipStatus: 'approved',
    },
    {
      userId: testUser.id,
      bubbleId: pendingBubble.id,
      role: 'admin',
      membershipStatus: 'approved',
    },
  ]);
  console.log('  Created memberships');

  console.log('\nTest data seeded successfully.');
  console.log('  Login:  test@example.com  /  TestPass123!');
  console.log('  Admin:  admin@example.com /  AdminPass123!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
