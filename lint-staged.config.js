import path from "path";

const mobileDir = path.resolve("mobile");

export default {
  "**/*.{ts,tsx}": (filenames) => {
    const hasRoot = filenames.some(
      (f) => !path.resolve(f).startsWith(mobileDir + path.sep)
    );
    const hasMobile = filenames.some((f) =>
      path.resolve(f).startsWith(mobileDir + path.sep)
    );
    const commands = [];
    if (hasRoot) commands.push("tsc --noEmit");
    if (hasMobile) commands.push("bash -c 'cd mobile && tsc --noEmit'");
    return commands;
  },
};
