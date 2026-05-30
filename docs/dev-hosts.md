# Dev host naming & connectivity

How the app and server find each other across the targets we support: macOS host,
iOS simulator, Android emulator (AOSP), Genymotion, real devices on the LAN, real
devices off the LAN, and production. This document explains the model, the
trade-offs of each connectivity option (including a sober look at Tailscale /
WireGuard), and the two safety nets we should add: a **preflight gate** and a
**runtime soft-landing screen**.

It is deliberately vendor-skeptical. The default recommendation uses nothing but
DNS, Let's Encrypt, and `adb reverse` — all free and already in our control.

---

## 1. The one fact everything depends on

Editing the **host Mac's** `/etc/hosts` only affects processes that use the **Mac's
resolver**: the Mac itself and the **iOS simulator** (it shares the host network
stack). It does **not** reach the Android emulator, Genymotion, or any real
device — each is a separate network node with its own resolver and its own idea
of what `localhost` means.

| Where code runs | `localhost` means | Reaches the Mac via | Mac `/etc/hosts` applies? |
|---|---|---|---|
| Mac host | the Mac | `localhost` | yes |
| **iOS simulator** | the Mac | `localhost` / Mac LAN IP | **yes** |
| Android emulator (AOSP) | the emulator VM | `10.0.2.2`, or `localhost` + `adb reverse` | no |
| **Genymotion** (VirtualBox) | the Genymotion VM | `10.0.3.2`, or `localhost` + `adb reverse` | no |
| Real device on LAN (USB) | the device | Mac LAN IP, or `localhost` + `adb reverse` | no |
| Real device off LAN | the device | public host / VPN | no |

This is why the original "name the hosts and map them in `/etc/hosts`" plan
**half worked**: it covered the Mac and the iOS simulator and nothing else. It is
also why nobody noticed `mobile/.env` had drifted to `TLW-2024.local` — that name
resolves on the Mac via Bonjour, so it resolved on the simulator too. (See §7.)

**The unifier:** `adb reverse tcp:PORT tcp:PORT` forwards the *device's own*
`localhost:PORT` to the *Mac's* `localhost:PORT` over the adb channel, independent
of IP routing. For every adb-connected target (AOSP emulator, Genymotion, USB
device), `localhost` then means "the Mac." That collapses the `10.0.2.2` vs
`10.0.3.2` vs LAN-IP differences into a single address.

---

## 2. Where the names live: env layer, not `/etc/hosts`

We keep the *naming* (the thing scripts reference) but move the *resolution* up
from `/etc/hosts` (host-only) to an **environment layer** (per-target).

Three logical roles, already used in the repo:

- `api_host`  — the API server (`docs/openapi.yaml` already uses `http://api_host:3000`)
- `db_host`   — Postgres (`/.env` already uses `postgresql://…@db_host/…`)
- `metro_host`— the Metro bundler (Maestro scripts already use `metro_host`)

Scripts and committed config reference these **names**; each machine/CI supplies
the **values** through an untracked env file. No machine-specific name
(`TLW-2024.local`, a LAN IP, a Replit URL) ever lands in a committed script.

Resolution per environment:

| Environment | `api_host` / `metro_host` resolves to | Plumbing required |
|---|---|---|
| Local, iOS simulator | `localhost` | none (native) |
| Local, Android emu / Genymotion / USB | `localhost` | `scripts/dev-connect.sh` (runs `adb reverse`) |
| LAN peer (another machine here) | that machine's LAN IP | nothing, same Wi-Fi |
| Shared dev / staging | a public DNS name w/ TLS | deploy once (see §4) |
| Production | `trybubble.io` | already set in `eas.json` |

`mobile/src/config/api.ts` already reads `process.env.EXPO_PUBLIC_API_URL`, so the
app needs **no code change** — only the env value differs per environment.
(Note: `api.ts` also checks `Constants.expoConfig?.extra?.apiUrl` first, which is
currently unset in `app.json`, and falls back to a hard-coded Replit URL last.
Those fallbacks should eventually go; they are silent footguns.)

---

## 3. Connectivity options, with costs and trade-offs

### Option A — `adb reverse` + `localhost` (local on-device dev)
- **Cost:** free; ships with the Android SDK.
- **Covers:** AOSP emulator, Genymotion, USB-attached real device.
- **Why:** one address (`localhost`) for all adb targets; immune to the emulator's
  NAT routing (this is what fixed the "Bundling 98.7%" freeze — the emulator had
  flipped its default route to its simulated cellular interface and could no
  longer reach `10.0.2.2`).
- **Limits:** only works while the device is adb-attached. Does nothing for a
  device that has left the cable / LAN.

### Option B — Public host + DNS + Let's Encrypt (shared dev, staging, production)
- **Cost:** the VPS you were already going to rent (Linode/Hetzner/Fly ≈ $4–6/mo),
  the domain you already own (~$12/yr), Let's Encrypt certs **free**.
- **Covers:** every device, on or off LAN, no client install, no VPN.
- **Why:** this is the production path anyway, and it doubles as the answer to
  "test from another house / AWS / a roaming phone." Valid TLS everywhere means no
  cleartext exceptions and no iOS ATS friction (see §5).
- **Limits:** you must operate it: TLS renewal (automated), auth, rate limiting,
  patching, firewall. Standard, well-understood work.
- **This is the recommended backbone.** It directly serves the goal of getting off
  Replit/Expo hosting.

### Option C — Tailscale (optional convenience, *not* a backbone)
- **Cost:** **free** at our scale — the Personal tier covers 3 users / 100 devices,
  MagicDNS, and Let's Encrypt certs for `*.ts.net` names. Paid tiers (~$6/user/mo)
  only buy team ACLs / SSO we don't need yet.
- **What it actually buys:** reach a machine that has **no public IP** — e.g. your
  laptop's dev API or Metro — from a roaming real device, privately, with a stable
  MagicDNS name and *valid* HTTPS, without deploying anything.
- **Honest scope:** this is a *developer convenience for the laptop-as-server
  case*. It does **not** compete with Option B. If the API lives on a public host
  (B), you do not need Tailscale to reach the API from anywhere — DNS already does
  that. Most "roaming device" needs are better met by a preview build (bundled JS)
  pointed at the public API, which needs no tunnel at all.
- **Costs that aren't dollars:** it adds a **vendor to your trust chain** (see §5)
  and a client install on every device — mildly counter to the "reduce vendor
  lock-in" goal.

### Option D — WireGuard, self-hosted
- **Cost:** free software; you operate it. Realistically a $5/mo VPS as a public
  relay/endpoint, plus your time managing keys and peers.
- **vs Tailscale:** same data plane (Tailscale *is* WireGuard underneath). You trade
  Tailscale's hosted control plane (key exchange, NAT traversal, MagicDNS, ACLs)
  for full control and a smaller trust surface. More setup, no third party.

### Option E — Public reverse tunnel (`cloudflared`, `ngrok`, `expo start --tunnel`)
- **Cost:** free tiers exist; stable URLs/custom domains are paid.
- **Use:** quick "share my localhost publicly for an hour." Good for a one-off demo
  or letting Metro reach a roaming device.
- **Limits:** rotating URLs on free tiers; you are exposing a dev box to the public
  internet for the tunnel's lifetime. Fine occasionally, poor as a standing setup.

### Recommendation
1. **Local on-device dev →** Option A (`adb reverse` + `localhost`); iOS sim needs nothing.
2. **Anything shared, off-LAN, or production →** Option B (public host + DNS + Let's Encrypt).
3. **Tailscale (C) only if** you find yourself repeatedly needing a roaming real
   device to hit your *laptop's* dev server and a preview build won't do. Then use
   its HTTPS for valid TLS and accept the vendor dependency. Otherwise skip it.

---

## 4. Does the Metro dependency end with native store builds?

Mostly yes. Metro plays three distinct roles:

- **Dev-time server** (debug builds only): the app fetches the bundle from Metro and
  gets Fast Refresh. This is the only *live* Metro dependency, and it is debug-only.
- **Build-time bundler** (release): the JS is compiled into the binary
  (Android `createBundleReleaseJsAndAssets`; iOS "Bundle React Native code and
  images"). A store build loads JS from local assets — **no Metro at runtime.**
- **Web:** `expo export --platform web` runs Metro *at build time* to emit static
  JS/HTML; the Express server then serves those static files. So production web
  needs the **build step**, not a running Metro. ("Metro for web" is a dev-server
  convenience, not a runtime requirement.)

What does **not** end with any build is the **API server** dependency (port 3000 →
`https://trybubble.io` in prod). That is separate from Metro and is exactly what the
named-host layer governs.

---

## 5. Security & TLS

### Cleartext / TLS — the sharp question
- iOS **App Transport Security** and Android's **cleartext policy (API 28+)** both
  block plain `http://` by default. Our `app.json` has **no exceptions** — which
  means dev-over-HTTP works *only* because Expo's **debug** builds relax these
  policies (localhost ATS exception on iOS, `usesCleartextTraffic` on Android).
- Consequence: **dev generally needs no local TLS** (debug defaults allow cleartext
  to `localhost`/LAN). You hit the TLS wall the moment you point a **preview/release**
  build at an `http://` dev host, or use stricter device policy.
- Therefore: prefer **real TLS** over maintaining cleartext exceptions.
  - Option B (public host) → Let's Encrypt on `api.trybubble.io`: valid TLS
    everywhere, no exceptions. Cleanest.
  - Option C (Tailscale) → can mint a real Let's Encrypt cert for the `*.ts.net`
    MagicDNS name, so dev gets valid HTTPS with no cert-install friction. This is a
    genuine (non-marketing) point in its favor *if* you adopt it.
  - Local self-signed (e.g. `mkcert`) → works, but you must install the root CA on
    every simulator/device; painful on real devices. Avoid unless necessary.
- **Smell to avoid:** a cleartext exception added "just for dev" that leaks into the
  release network-security-config. Keep any such exception debug-scoped.

### Trust surface of each option
- **Public host (B):** you expose a port; you own hardening (TLS, authn,
  rate-limit, firewall, patching). Familiar model.
- **Tailscale (C):** the data plane is end-to-end WireGuard (the vendor cannot read
  traffic), **but** the *control plane* — their coordination server — decides which
  node keys are trusted. A compromise of your Tailscale account/identity could admit
  a rogue node to the tailnet. You are trusting their identity layer, and the mesh
  traverses NAT (connectivity that bypasses your usual perimeter). Acceptable for a
  small project; still a third party in the trust chain.
- **WireGuard self-hosted (D):** smallest trust surface — you hold all keys — at the
  price of operating it correctly.

---

## 6. Safety nets these changes imply

You are right that depending on a resolvable, reachable host means we should fail
loudly and early, and degrade gracefully.

### 6a. Preflight gate (before build / run) — `scripts/preflight-hosts.sh`
Resolve and TCP-connect to `api_host` and `metro_host` before a dev build/run; exit
non-zero with a human message if either is unreachable. Cheap insurance against the
white-screen/ANR failure mode. Wire it into the `mobile:build:*` / `mobile:start`
npm scripts as a `pre` step. (Concrete script committed alongside this doc.)

### 6b. Runtime soft-landing screen
Today, an unreachable API produces a white screen and then an ANR — the app keeps
trying and never tells the user anything. Add a connectivity gate at boot: probe
`GET ${API_URL}/health` (or `/api/config/share-base-url`) with a short timeout; on
failure render a friendly screen instead of mounting the app blind:

```tsx
// mobile/src/screens/system/ConnectivityGate.tsx  (sketch — wire into RootNavigator)
export function ConnectivityGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'unreachable'>('checking');
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    fetch(`${API_URL}/api/config/share-base-url`, { signal: ctrl.signal })
      .then(r => setState(r.ok ? 'ok' : 'unreachable'))
      .catch(() => setState('unreachable'))
      .finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctrl.abort(); };
  }, []);

  if (state === 'checking') return <Splash />;
  if (state === 'unreachable')
    return (
      <CenteredMessage
        title="Can't reach Bubble"
        body={__DEV__
          ? `Dev API ${API_URL} is unreachable. Is the server running, and did you run scripts/dev-connect.sh?`
          : "We can't reach Bubble's servers right now. Check your connection and try again."}
        onRetry={() => setState('checking')}
      />
    );
  return <>{children}</>;
}
```

This is good practice regardless of which connectivity option you choose.

---

## 7. Why iOS didn't need any of this

Because the iOS **simulator** shares the Mac's network stack and resolver:
- `localhost` already means the Mac, so no `adb reverse`, no `10.0.2.2`.
- The Mac's Bonjour resolves `TLW-2024.local`, so the bad value in `mobile/.env`
  resolved on the simulator and the breakage stayed invisible.
- Expo's debug ATS exception let cleartext `http://localhost` through.

That is **simulator-only luck**. A real iOS device has none of it: it would need the
Mac's LAN IP (on-LAN) or a public host / VPN (off-LAN), and iOS ATS would force the
same TLS conversation as everything else. So "iOS didn't need it" really means
"the iOS simulator hid it." The named-host + TLS plan is what makes a real iOS
device, a real Android device, Genymotion, and CI all behave the same.

---

## 8. Off-LAN real device — decision summary

| Need | Cheapest correct answer |
|---|---|
| API reachable from a roaming phone | Deploy API to a public host w/ DNS + Let's Encrypt (Option B). For a release/preview build that's all you need — JS is bundled in. |
| Live JS reload on a roaming phone (rare) | Tailscale (C) or `expo start --tunnel` (E). |
| Private mesh between your dev machines / a home box / cloud | Tailscale (C) for convenience, or WireGuard (D) for no vendor. |

Net: **DNS + a public host covers production and the bulk of off-LAN testing for
near-zero marginal cost.** Reserve Tailscale/WireGuard for the genuine
"reach a machine with no public IP" case, and treat it as optional.
