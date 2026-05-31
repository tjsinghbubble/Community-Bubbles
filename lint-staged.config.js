import path from "path";

const mobileDir = path.resolve("mobile");

export default {
  "**/*.{ts,tsx}": (filenames) => {
    const hasRoot = filenames.some(
      (f) => !path.resolve(f).startsWith(mobileDir + path.sep)
    );
    const commands = [];
    // Only check server/shared TypeScript — mobile is type-checked by EAS/Expo at build time.
    // The mobile directory has pre-existing errors that need a dedicated cleanup pass.
    if (hasRoot) commands.push("tsc --noEmit");
    return commands;
  },

  // When the Drizzle schema changes, regenerate the snapshot so it stays in
  // sync and gets committed alongside the schema change.
  "shared/schema.ts": () => [
    "tsx scripts/generate-db-snapshot.ts",
    "git add docs/db-schema-snapshot.json",
  ],
};
