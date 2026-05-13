import fs from "fs";
import { CTX_FILE } from "./global-setup.ts";

export interface TestContext {
  adminToken: string;
  adminEmail: string;
  userToken: string;
  userEmail: string;
  bubbleId: string | null;
  bubbleShortId: string | null;
  eventId: string | null;
  eventShortId: string | null;
}

export function ctx(): TestContext {
  return JSON.parse(fs.readFileSync(CTX_FILE, "utf-8")) as TestContext;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
