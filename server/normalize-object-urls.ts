import { pool } from "./db";

const LOG = "[normalize-object-urls]";

/**
 * Rewrite absolute object-storage URLs to relative ones across the database.
 *
 * Historical/imported rows stored image URLs as absolute links pointing at a
 * specific host (e.g. `https://community-bubbles.replit.app/objects/...` or
 * `https://trybubble.io/objects/...`). When the repl is moved or the domain
 * changes, the host-specific links break. Relative links (`/objects/...`) are
 * resolved by the client against the current API host (see the mobile
 * `resolveMediaUrl` helper and the web served origin), so they survive domain
 * changes.
 *
 * This converts any `http(s)://<host>/objects/...` value to `/objects/...`.
 * It is idempotent: the guarded WHERE clause makes it a no-op once normalized,
 * so it is safe to run on every boot. Each statement is isolated so a missing
 * column/table never aborts the whole pass (or server startup).
 */
export async function normalizeObjectUrls(): Promise<void> {
  // [table, column] pairs holding a single URL (text columns).
  const textCols: Array<[string, string]> = [
    ["bubbles", "cover_image"],
    ["events", "cover_image"],
    ["users", "profile_photo"],
    ["user_profiles", "profile_photo"],
    ["bulletin_posts", "image_url"],
    ["categories", "image"],
  ];

  // [table, column] pairs holding an array of URLs (text[] columns).
  const arrayCols: Array<[string, string]> = [
    ["bubbles", "images"],
    ["events", "images"],
  ];

  const HOST_RE = "^https?://[^/]+/objects/";
  const SUB = "^https?://[^/]+(/objects/)";

  let changed = 0;

  for (const [table, col] of textCols) {
    try {
      const res = await pool.query(
        `UPDATE ${q(table)} SET ${q(col)} = regexp_replace(${q(col)}, $1, '\\1')
          WHERE ${q(col)} ~ $2`,
        [SUB, HOST_RE],
      );
      if (res.rowCount) {
        changed += res.rowCount;
        console.log(`${LOG} ${table}.${col}: ${res.rowCount} rows`);
      }
    } catch (e) {
      console.warn(`${LOG} skip ${table}.${col}:`, (e as Error).message);
    }
  }

  for (const [table, col] of arrayCols) {
    try {
      const res = await pool.query(
        `UPDATE ${q(table)} t
            SET ${q(col)} = sub.arr
           FROM (
             SELECT x.id,
                    array_agg(regexp_replace(elem, $1, '\\1') ORDER BY ord) AS arr
               FROM ${q(table)} x,
                    unnest(x.${q(col)}) WITH ORDINALITY AS u(elem, ord)
              GROUP BY x.id
           ) sub
          WHERE t.id = sub.id
            AND EXISTS (
              SELECT 1 FROM unnest(t.${q(col)}) AS e WHERE e ~ $2
            )`,
        [SUB, HOST_RE],
      );
      if (res.rowCount) {
        changed += res.rowCount;
        console.log(`${LOG} ${table}.${col}: ${res.rowCount} rows`);
      }
    } catch (e) {
      console.warn(`${LOG} skip ${table}.${col}:`, (e as Error).message);
    }
  }

  if (changed > 0) {
    console.log(`${LOG} Normalized ${changed} rows to relative object URLs`);
  }
}

function q(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}
