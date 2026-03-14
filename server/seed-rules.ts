import { db } from "./db";
import { rules, appRules } from "@shared/schema";

const APP_LEVEL_RULES = [
  "Be Kind. Treat all members with kindness and courtesy.",
  "Respect Privacy. Don't share anyone's personal info without permission.",
  "Keep It Safe. No threats, dangerous behavior, or anything that could harm others.",
  "No Scams or Spam. No fraud, promotions, or unwanted selling unless the Bubble allows it.",
  "Be Real. Use your real identity and be honest in your interactions.",
  "Respect the Vibe. Follow each Bubble's unique guidelines and culture.",
  "Show Up. Honor your commitments, whether you're hosting or attending.",
  "Act Like You're in Public. Keep content appropriate for a community setting.",
];

export async function seedRules() {
  const existingAppRules = await db.select().from(appRules);
  if (existingAppRules.length > 0) {
    console.log("[SEED] App rules already seeded, skipping");
    return;
  }

  for (let i = 0; i < APP_LEVEL_RULES.length; i++) {
    const [rule] = await db.insert(rules).values({
      text: APP_LEVEL_RULES[i],
    }).returning();

    await db.insert(appRules).values({
      ruleId: rule.id,
      position: i + 1,
    });
  }

  console.log(`[SEED] ${APP_LEVEL_RULES.length} app-level rules seeded successfully`);
}
