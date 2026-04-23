import { db } from "./db";
import { bubbles, events } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const LOG = "[seed-bubble-images]";

interface BubbleImageSpec {
  title: string;
  unsplashUrl: string;
}

const BUBBLE_IMAGES: BubbleImageSpec[] = [
  { title: "Basketball",          unsplashUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { title: "Tennis",              unsplashUrl: "https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?w=800&q=80" },
  { title: "Tennis Circle",       unsplashUrl: "https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?w=800&q=80" },
  { title: "Cricket",             unsplashUrl: "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80" },
  { title: "Soccer",              unsplashUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  { title: "SF Pickleball Crew",  unsplashUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80" },
  { title: "Campus hoops",        unsplashUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { title: "Billiards",           unsplashUrl: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80" },
  { title: "Karting",             unsplashUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
  { title: "ABC Farm",            unsplashUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80" },
  { title: "Bark at Dogpatch",    unsplashUrl: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80" },
  { title: "Corgi Farm",          unsplashUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80" },
  { title: "Mexican food",        unsplashUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80" },
  { title: "Mexican Food Truck",  unsplashUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80" },
  { title: "Mindful Mamas",       unsplashUrl: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80" },
  { title: "My Test Bubble nRgP", unsplashUrl: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80" },
  { title: "Larry Bubble",        unsplashUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { title: "foo ar",              unsplashUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80" },
  { title: "Testing",             unsplashUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80" },
];

async function uploadImageFromUrl(service: ObjectStorageService, imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${imageUrl}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";

  const signedUrl = await service.getObjectEntityUploadURL();
  const objectPath = service.normalizeObjectEntityPath(signedUrl);

  const putResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(imageBuffer.length),
    },
    body: imageBuffer,
  });

  if (!putResponse.ok) {
    const body = await putResponse.text().catch(() => "");
    throw new Error(`GCS upload failed: ${putResponse.status} — ${body}`);
  }

  return objectPath;
}

async function findBubblesByTitle(title: string) {
  const all = await db.select({ id: bubbles.id, coverImage: bubbles.coverImage, title: bubbles.title }).from(bubbles);
  return all.filter(b => b.title?.trim() === title.trim());
}

function hasObjectStoragePath(coverImage: string | null | undefined): boolean {
  return !!coverImage && coverImage.includes("/objects/uploads/");
}

function toRelativePath(coverImage: string): string {
  const match = coverImage.match(/(\/objects\/uploads\/[^?#]+)/);
  return match ? match[1] : coverImage;
}

export async function seedBubbleImages(): Promise<void> {
  console.log(`${LOG} Starting bubble + event image upload`);

  const service = new ObjectStorageService();

  for (const spec of BUBBLE_IMAGES) {
    try {
      const matchedBubbles = await findBubblesByTitle(spec.title);

      if (matchedBubbles.length === 0) {
        console.log(`${LOG} "${spec.title}" not found in DB — skipping`);
        continue;
      }

      let sharedPath: string | null = null;

      for (const bubble of matchedBubbles) {
        if (hasObjectStoragePath(bubble.coverImage)) {
          sharedPath = toRelativePath(bubble.coverImage!);
          if (sharedPath !== bubble.coverImage) {
            await db.update(bubbles).set({ coverImage: sharedPath }).where(eq(bubbles.id, bubble.id));
          }
          console.log(`${LOG} "${spec.title}" (${bubble.id}) already done`);
        } else {
          if (!sharedPath) {
            console.log(`${LOG} Uploading image for "${spec.title}"...`);
            sharedPath = await uploadImageFromUrl(service, spec.unsplashUrl);
          }
          await db.update(bubbles).set({ coverImage: sharedPath }).where(eq(bubbles.id, bubble.id));
          console.log(`${LOG} "${spec.title}" bubble ${bubble.id} ✓ → ${sharedPath}`);
        }

        await db
          .update(events)
          .set({ coverImage: sharedPath })
          .where(and(eq(events.bubbleId, bubble.id), isNull(events.coverImage)));
      }

      console.log(`${LOG} "${spec.title}" done`);
    } catch (error) {
      console.error(`${LOG} Failed for "${spec.title}":`, error);
    }
  }

  console.log(`${LOG} Done`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedBubbleImages()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
