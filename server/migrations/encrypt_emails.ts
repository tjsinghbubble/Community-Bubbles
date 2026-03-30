import { db } from "../db";
import { users, userProfiles, verificationCodes } from "../../shared/schema";
import { encryptField, hashField } from "../encryption";
import { eq, isNull, isNotNull, and } from "drizzle-orm";

async function run() {
  // 1. Encrypt user emails (skip rows that already have emailHash)
  const plainUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isNull(users.emailHash));

  let userCount = 0;
  for (const user of plainUsers) {
    if (!user.email.includes(":")) {
      await db
        .update(users)
        .set({
          email: encryptField(user.email),
          emailHash: hashField(user.email),
        })
        .where(eq(users.id, user.id));
      userCount++;
    }
  }
  console.log(`Encrypted ${userCount} user emails`);

  // 2. Encrypt campus emails in user_profiles
  const plainProfiles = await db
    .select({
      userId: userProfiles.userId,
      campusEmail: userProfiles.campusEmail,
    })
    .from(userProfiles)
    .where(
      and(
        isNotNull(userProfiles.campusEmail),
        isNull(userProfiles.campusEmailHash)
      )
    );

  let campusCount = 0;
  for (const profile of plainProfiles) {
    if (profile.campusEmail && !profile.campusEmail.includes(":")) {
      await db
        .update(userProfiles)
        .set({
          campusEmail: encryptField(profile.campusEmail),
          campusEmailHash: hashField(profile.campusEmail),
        })
        .where(eq(userProfiles.userId, profile.userId));
      campusCount++;
    }
  }
  console.log(`Encrypted ${campusCount} campus emails`);

  // 3. Encrypt active verification code emails
  const plainCodes = await db
    .select({ id: verificationCodes.id, email: verificationCodes.email })
    .from(verificationCodes)
    .where(
      and(eq(verificationCodes.used, false), isNull(verificationCodes.emailHash))
    );

  let codeCount = 0;
  for (const code of plainCodes) {
    if (!code.email.includes(":")) {
      await db
        .update(verificationCodes)
        .set({
          email: encryptField(code.email),
          emailHash: hashField(code.email),
        })
        .where(eq(verificationCodes.id, code.id));
      codeCount++;
    }
  }
  console.log(`Encrypted ${codeCount} verification code emails`);
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
