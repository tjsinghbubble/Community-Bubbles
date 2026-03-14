import { db } from "./db";
import { rules, appRules } from "@shared/schema";

const APP_LEVEL_RULES = [
  { name: "Be Kind", description: "Treat all members with kindness and courtesy." },
  { name: "Respect Privacy", description: "Don't share anyone's personal info without permission." },
  { name: "Keep It Safe", description: "No threats, dangerous behavior, or anything that could harm others." },
  { name: "No Scams or Spam", description: "No fraud, promotions, or unwanted selling unless the Bubble allows it." },
  { name: "Be Real", description: "Use your real identity and be honest in your interactions." },
  { name: "Respect the Vibe", description: "Follow each Bubble's unique guidelines and culture." },
  { name: "Show Up", description: "Honor your commitments, whether you're hosting or attending." },
  { name: "Act Like You're in Public", description: "Keep content appropriate for a community setting." },
];

export async function seedRules() {
  const existingAppRules = await db.select().from(appRules);
  if (existingAppRules.length > 0) {
    console.log("[SEED] App rules already seeded, skipping");
    return;
  }

  for (let i = 0; i < APP_LEVEL_RULES.length; i++) {
    const { name, description } = APP_LEVEL_RULES[i];
    const text = `${name}. ${description}`;
    const [rule] = await db.insert(rules).values({
      text,
      name,
      description,
    }).returning();

    await db.insert(appRules).values({
      ruleId: rule.id,
      position: i + 1,
    });
  }

  console.log(`[SEED] ${APP_LEVEL_RULES.length} app-level rules seeded successfully`);
}
