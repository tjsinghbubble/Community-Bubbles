import fs from "fs";
import { CTX_FILE } from "./global-setup.ts";

export default async function globalTeardown() {
  if (fs.existsSync(CTX_FILE)) {
    fs.unlinkSync(CTX_FILE);
  }
}
