/**
 * Artifact naming + Maestro debug-output flattening.
 *
 * Standing rule (applies to every file/dir the test platform creates): names must be
 * easy to type at a shell. sanitizeFileName() enforces it:
 *   - Unix special characters are removed:  / ( ) & ; " ' < > { } [ ] @ | ? * \
 *   - whitespace (space, tab, newline) and control chars (< 0x20, 0x7F) are removed
 *   - Latin-1 "extended ASCII" (U+00A0–U+00FF) is converted to its HTML entity name
 *     wrapped in colons (é → :eacute:); U+0080–U+009F (no entity) → :U+8X:
 *   - any other non-ASCII (emoji, CJK, …) is removed
 *
 * Maestro's --debug-output buries badly-named files under .maestro/tests/<timestamp>/.
 * flattenMaestroDebugOutput() lifts them into the test's artifact dir with
 * function-first names (see RENAME RULES below) and deletes the .maestro tree, so a
 * run's artifacts are a single flat, typeable directory.
 */
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

// ── sanitizeFileName ─────────────────────────────────────────────────────────

const REMOVE_CHARS = new Set("/()&;\"'<>{}[]@|?*\\".split(""));

/** HTML entity names for U+00A0–U+00FF, in codepoint order. */
const LATIN1_ENTITIES = [
  "nbsp", "iexcl", "cent", "pound", "curren", "yen", "brvbar", "sect",
  "uml", "copy", "ordf", "laquo", "not", "shy", "reg", "macr",
  "deg", "plusmn", "sup2", "sup3", "acute", "micro", "para", "middot",
  "cedil", "sup1", "ordm", "raquo", "frac14", "frac12", "frac34", "iquest",
  "Agrave", "Aacute", "Acirc", "Atilde", "Auml", "Aring", "AElig", "Ccedil",
  "Egrave", "Eacute", "Ecirc", "Euml", "Igrave", "Iacute", "Icirc", "Iuml",
  "ETH", "Ntilde", "Ograve", "Oacute", "Ocirc", "Otilde", "Ouml", "times",
  "Oslash", "Ugrave", "Uacute", "Ucirc", "Uuml", "Yacute", "THORN", "szlig",
  "agrave", "aacute", "acirc", "atilde", "auml", "aring", "aelig", "ccedil",
  "egrave", "eacute", "ecirc", "euml", "igrave", "iacute", "icirc", "iuml",
  "eth", "ntilde", "ograve", "oacute", "ocirc", "otilde", "ouml", "divide",
  "oslash", "ugrave", "uacute", "ucirc", "uuml", "yacute", "thorn", "yuml",
];

/**
 * Make a single path component shell-typeable per the standing rule above.
 * "[](déme)[]" → "d:eacute:me"; "▌head" stays codepoint-tagged only for the
 * Latin-1 range — characters above U+00FF are dropped.
 */
export function sanitizeFileName(name: string): string {
  let out = "";
  for (let i = 0; i < name.length; ) {
    const cp = name.codePointAt(i)!;
    i += cp > 0xffff ? 2 : 1; // step over surrogate pairs
    if (cp < 0x20 || cp === 0x7f) continue;            // control chars
    if (cp > 0xff) continue;                            // emoji, CJK, … : dropped
    const ch = String.fromCharCode(cp);
    if (/\s/.test(ch)) continue;                        // whitespace
    if (REMOVE_CHARS.has(ch)) continue;                 // unix specials
    if (cp <= 0x7e) { out += ch; continue; }            // plain ASCII
    if (cp <= 0x9f) { out += `:U+${cp.toString(16).toUpperCase()}:`; continue; }
    out += `:${LATIN1_ENTITIES[cp - 0xa0]}:`;           // U+A0–U+FF → entity name
  }
  return out || "unnamed";
}

// ── Maestro debug-output flattening ──────────────────────────────────────────

/** Maestro tags failure/warning screenshots with an emoji; translate to a word. */
const SCREENSHOT_WORDS: Record<string, string> = {
  "❌": "FAIL",
  "⚠️": "WARNING", // with U+FE0F variation selector
  "⚠": "WARNING",
  "✅": "PASS",
};

/** Unix-epoch ms → local HHMMSS.tenths, e.g. 090704.5 (matches run-log times). */
function localTimeStamp(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${Math.floor(d.getMilliseconds() / 100)}`;
}

/**
 * RENAME RULES — Maestro debug file → function-first name (leaf = "<test-id>-<role>"):
 *   maestro.log                          → internal-maestro-log.log   ("internal": verbose, rarely useful)
 *   ai-(<flow>).json                     → detailed-log--<leaf>.json  (double dash: warning, very detailed)
 *   ai-report-<flow>.html                → WIP-report-<leaf>.html     (report generation not working yet)
 *   commands-(<flow>.yaml).json          → maestro-flow-details-<leaf>.json
 *   screenshot-<emoji>-<epochms>-(…).png → screenshot-<WORD>-time-<HHMMSS.s>-<leaf>.png
 *   anything else                        → sanitizeFileName(original)
 */
function renameMaestroArtifact(name: string, leaf: string): string | null {
  if (name === ".DS_Store") return null; // drop
  if (name === "maestro.log") return "internal-maestro-log.log";
  if (/^ai-report-.*\.html$/.test(name)) return `WIP-report-${leaf}.html`;
  if (/^ai-\(.*\)\.json$/.test(name)) return `detailed-log--${leaf}.json`;
  if (/^commands-\(.*\)\.json$/.test(name)) return `maestro-flow-details-${leaf}.json`;
  const shot = name.match(/^screenshot-(.+?)-(\d{10,})-\(.*\)\.png$/);
  if (shot) {
    const word = SCREENSHOT_WORDS[shot[1]] ?? sanitizeFileName(shot[1]);
    return `screenshot-${word}-time-${localTimeStamp(Number(shot[2]))}-${leaf}.png`;
  }
  return sanitizeFileName(name);
}

/** Non-clobbering destination: name.ext, name.2.ext, name.3.ext, … */
function uniqueDest(dir: string, name: string): string {
  let dest = join(dir, name);
  if (!existsSync(dest)) return dest;
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 2; ; i++) {
    dest = join(dir, `${stem}.${i}${ext}`);
    if (!existsSync(dest)) return dest;
  }
}

/**
 * Lift everything Maestro wrote under <artifactsDir>/.maestro/tests/<timestamp>/ up into
 * <artifactsDir> itself (renamed per the rules above), then delete the .maestro tree.
 * Newest timestamp dir is processed first so its files get the canonical names; older
 * duplicates (e.g. the driver-install maestro.log) get a .2/.3 suffix.
 * Best-effort: artifact cleanup must never fail a test run.
 */
export function flattenMaestroDebugOutput(artifactsDir: string, leaf: string): void {
  try {
    const maestroRoot = join(artifactsDir, ".maestro");
    const stampsRoot = join(maestroRoot, "tests");
    if (existsSync(stampsRoot)) {
      const stampDirs = readdirSync(stampsRoot)
        .map((n) => join(stampsRoot, n))
        .filter((p) => statSync(p).isDirectory())
        .sort()
        .reverse(); // timestamp names sort chronologically; newest first
      for (const dir of stampDirs) {
        for (const file of walkFiles(dir)) {
          const newName = renameMaestroArtifact(basename(file), leaf);
          if (newName === null) continue;
          renameSync(file, uniqueDest(artifactsDir, newName));
        }
      }
    }
    if (existsSync(maestroRoot)) rmSync(maestroRoot, { recursive: true, force: true });
  } catch { /* best-effort */ }
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

// ── test-source copies ───────────────────────────────────────────────────────

/**
 * Copy the flow yaml that ran — plus every yaml it references via `file:` / `runFlow:`,
 * recursively — into <artifactsDir>/flow/, preserving paths relative to tests/e2e so the
 * copies' relative references still line up. Best-effort.
 */
export function copyFlowSources(flowPath: string, artifactsDir: string, e2eRoot: string): void {
  try {
    const destRoot = join(artifactsDir, "flow");
    const seen = new Set<string>();
    const copyOne = (abs: string): void => {
      if (seen.has(abs) || !existsSync(abs)) return;
      seen.add(abs);
      const rel = relative(e2eRoot, abs);
      const relSafe = rel.startsWith("..")
        ? sanitizeFileName(basename(abs))
        : rel.split(sep).map(sanitizeFileName).join(sep);
      const dest = join(destRoot, relSafe);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(abs, dest);
      const text = readFileSync(abs, "utf8");
      // `file: ../common/login-as.yaml` and the shorthand `runFlow: foo.yaml`
      const ref = /^\s*(?:-\s*)?(?:file|runFlow):\s*["']?([^\s"'#]+\.ya?ml)/gm;
      let m: RegExpExecArray | null;
      while ((m = ref.exec(text)) !== null) copyOne(resolve(dirname(abs), m[1]));
    };
    copyOne(resolve(flowPath));
  } catch { /* best-effort */ }
}

/** Headless analog: copy the test source (vitest .ts / newman collection) into the artifact dir. */
export function copyTestSource(testPath: string, artifactsDir: string): void {
  try {
    copyFileSync(testPath, join(artifactsDir, sanitizeFileName(basename(testPath))));
  } catch { /* best-effort */ }
}
