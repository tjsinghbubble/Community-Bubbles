/**
 * Test discovery + tag-based selection across both engines (Maestro e2e + headless TS/newman).
 *
 * Tags live next to each test:
 *   - Maestro flows: native `tags:` block in the YAML header + a `# qa-id:` comment.
 *   - Headless TS:    `// qa-id:` and `// qa-tags:` comments.
 * The newman contract collection is registered as a single synthetic descriptor.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, "..");

export type Tool = "maestro" | "vitest" | "newman";
export type Layer = "e2e" | "headless";

export interface TestDescriptor {
  id: string;
  tool: Tool;
  layer: Layer;
  path: string; // absolute
  tags: string[];
  /** role-* tags expanded for execution; empty = role-agnostic (run once). */
  roles: string[];
  /** Human-readable purpose from a `# qa-reason:` / `// qa-reason:` line; shown in run output. */
  reason?: string;
}

const ALL_ROLES = ["role-user", "role-bubble-admin", "role-site-admin"];

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return walk(dir).filter((f) => f.endsWith(ext));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Extract the YAML header (everything before the first `---` line). */
function maestroHeader(text: string): string {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim() === "---");
  return (idx === -1 ? lines : lines.slice(0, idx)).join("\n");
}

function parseMaestroTags(header: string): string[] {
  // inline form: tags: [a, b, c]
  const inline = header.match(/^tags:\s*\[(.*)\]/m);
  if (inline) {
    return inline[1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  // block form: tags:\n  - a\n  - b
  const lines = header.split("\n");
  const start = lines.findIndex((l) => /^tags:\s*$/.test(l));
  if (start === -1) return [];
  const tags: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s*(.+?)\s*$/);
    if (!m) break;
    // YAML allows trailing comments on list items (`- external  # why`); keep only the value.
    const tag = m[1].replace(/\s+#.*$/, "").trim();
    if (tag) tags.push(tag);
  }
  return tags;
}

function parseComment(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`(?://|#)\\s*${key}:\\s*(.+)`));
  return m?.[1].trim();
}

function rolesFromTags(tags: string[]): string[] {
  if (tags.includes("role-any")) return [...ALL_ROLES];
  return tags.filter((t) => ALL_ROLES.includes(t));
}

export function discoverAll(): TestDescriptor[] {
  const descriptors: TestDescriptor[] = [];

  // Maestro e2e flows (skip the common/ subflows — they are includes, not tests).
  for (const file of listFiles(join(TESTS_ROOT, "e2e"), ".yaml")) {
    if (relative(TESTS_ROOT, file).includes(`${"e2e"}/common/`)) continue;
    const text = readFileSync(file, "utf8");
    const header = maestroHeader(text);
    const tags = parseMaestroTags(header);
    const id = parseComment(text, "qa-id");
    if (!id) continue; // not a registered test
    descriptors.push({
      id,
      tool: "maestro",
      layer: "e2e",
      path: file,
      tags,
      roles: rolesFromTags(tags),
      reason: parseComment(text, "qa-reason"),
    });
  }

  // Headless TS tests.
  for (const file of listFiles(join(TESTS_ROOT, "headless"), ".headless.test.ts")) {
    const text = readFileSync(file, "utf8");
    const id = parseComment(text, "qa-id");
    const tagsRaw = parseComment(text, "qa-tags");
    if (!id || !tagsRaw) continue;
    const tags = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    descriptors.push({ id, tool: "vitest", layer: "headless", path: file, tags, roles: [], reason: parseComment(text, "qa-reason") });
  }

  // newman contract collection (synthetic single descriptor).
  const collection = join(TESTS_ROOT, "headless/contract/contract-smoke.postman_collection.json");
  if (existsSync(collection)) {
    descriptors.push({
      id: "contract-0100",
      tool: "newman",
      layer: "headless",
      path: collection,
      tags: ["contract", "smoke", "headless"],
      roles: [],
      reason: "API contract smoke (auth + core endpoints)",
    });
  }

  return descriptors;
}

export interface SelectFilters {
  tags: string[]; // every tag must be present (AND); [] = no selection-tag requirement
  areas?: string[]; // OR across areas
  layers: Layer[];
  roles?: string[]; // restrict expanded roles
  includeUnverified: boolean;
}

export const AREA_TAGS = new Set([
  "auth", "discovery", "joining", "inside", "events", "bubble-admin", "site-admin",
  "comms", "campus", "notification", "categories", "reports", "monitoring", "rules",
  "perf", "security", "contract", "infra", "wander",
]);

export function selectTests(all: TestDescriptor[], f: SelectFilters): TestDescriptor[] {
  return all
    .filter((t) => f.layers.includes(t.layer))
    .filter((t) => (f.includeUnverified ? true : !t.tags.includes("unverified")))
    .filter((t) => f.tags.every((tag) => t.tags.includes(tag)))
    .filter((t) => {
      if (!f.areas || f.areas.length === 0) return true;
      return t.tags.some((tag) => AREA_TAGS.has(tag) && f.areas!.includes(tag));
    })
    .map((t) => {
      if (!f.roles || t.roles.length === 0) return t;
      return { ...t, roles: t.roles.filter((r) => f.roles!.includes(r)) };
    });
}
