// Reads a required public env var. Throws loudly if it is unset so a
// misconfigured build fails immediately and obviously, instead of silently
// falling back to a hard-coded value baked into source (which is how live keys
// drift into the repo). See docs/dev-hosts.md.
//
// Note: EXPO_PUBLIC_* vars are inlined by Metro only when referenced as a static
// literal (e.g. process.env.EXPO_PUBLIC_FOO). Always pass the *value* here, and
// the name purely for the error message — never look it up dynamically.
export function requireEnv(name: string, value: string | undefined | null): string {
  if (value == null || value === "") {
    throw new Error(
      `Missing required env var ${name}. Set it in mobile/.env for local dev, ` +
        `or via EAS secrets / EXPO_PUBLIC_* for builds. See docs/dev-hosts.md.`
    );
  }
  return value;
}
