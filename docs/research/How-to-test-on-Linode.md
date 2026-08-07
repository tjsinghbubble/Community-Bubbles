# How to test Bubble on Linode: real-world performance and cost, on a pocket-money budget

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Written 2026-07-18. This is the cloud follow-up to the laptop-based [perf-test-plan.md](perf-test-plan.md) — it reuses the same tools and scenarios, adjusted so the results reflect real-world conditions and real-world money. It assumes the test deployment from [How-to-move-to-Linode.html](How-to-move-to-Linode.html) is up and verified.*

## What this weekend of testing should establish

1. **Do the laptop conclusions hold on a real cloud server?** The laptop said one 2-CPU server carries everything with 4× headroom. Confirm CPU, memory, response times, and zero-failure behavior on actual Linode hardware.
2. **What does traffic actually cost?** Measure real bytes leaving the server per unit of user activity — especially **images, which the laptop tests never measured** — and convert to monthly dollars per usage scenario, on Linode and (for comparison) on a big-three vendor.
3. **How do real response times feel** from across the internet, not from a laptop talking to itself?

**Total incremental cost of everything below: roughly $3–6.** The server bills $0.036/hour, the optional second machine $0.0075/hour, and — for reasons explained next — the bandwidth used by these tests costs approximately nothing on Linode.

## The frank part first: egress costs, and why Linode makes this weekend safe

You asked where costs could spike. Here is the honest picture.

**On Linode, you essentially cannot spike the bill in a weekend — even deliberately.** The server's plan includes a large monthly transfer allowance (4 TB, pooled account-wide and **prorated by how long the server has existed** — a server alive for 48 hours has earned roughly 260 GB of allowance). And past the allowance, Linode charges **half a cent per GB**. If a runaway test somehow pushed 200 GB past the pool, that is one dollar. This safety margin is a genuine reason Linode came out well in the vendor research.

**The same behavior priced elsewhere is a different story, and that is the real point of measuring.** The big three charge ~$0.09/GB. The measurements you take this weekend are what let us say with confidence what any usage level would cost *on any vendor*, and what Replit's pricing is really competing against.

**Where a spike-shaped risk actually lives in our product today:** the 124 MB of uncompressed category images served with caching disabled ([image-costs-and-caching.md](image-costs-and-caching.md)). One cold load of the create-bubble grid is ~40 MB. That is: ~$0.0002 of Linode overage, ~$0.004 on AWS — but multiplied by every user, every cache eviction, forever, it is the difference between "bandwidth rounds to zero" and "bandwidth is a real line item," and it is simultaneously a UX problem (40 MB on cellular) and the cause of the offline-icons bug.

**Frank advice, in order:**

1. **Fix the image serving before scale, regardless of hosting vendor** — compress the 38 category images (124 MB → ~5 MB) and turn on cache headers (a one-line server change). These are the two cheapest infrastructure fixes available to this project, and they remove the only genuine egress-spike mechanism we have.
2. **This weekend, measure image traffic with short, small runs and multiply with arithmetic.** Do not hammer image downloads for hours — a 5-minute measured sample extrapolates perfectly and tells you everything a 5-hour hammer would, for 1/60th of the bytes and time.
3. **If tests will run from your home Mac, remember your home connection is the bottleneck and the meter** for image-heavy runs — a 40 MB/load test at any real rate will saturate a residential uplink long before it stresses the server. Use the in-cloud driver (below) for the image sampling.
4. **After the image fixes land, re-run the image sample** — the before/after delta is the business case for the fix, stated in dollars.

## Test setup

### Two driver options (where simulated traffic comes from)

| Driver | What it's good for | Cost |
|---|---|---|
| **Your Mac at home** | Real-internet response times — what a user actually feels | $0 |
| **A $5 Nanode in another Linode region** (e.g. `us-ord`) | Clean, fast, unmetered-at-home load generation; the image-traffic sampling | ~$0.36 for the weekend |

Create the driver Nanode with the same one-liner as the main server (Phase 2 of the runbook) but `--type g6-nanode-1 --region us-ord --label bubble-driver`, install k6 on it (`sudo apt-get install -y gpg; ...` or simply `docker run --rm -i grafana/k6`), and delete it with the rest at teardown.

### One server-side adjustment before any load run

The app deliberately limits login attempts per address (10 per 15 minutes) — a load driver trips it instantly (this failed the first laptop run too). On the **server**, add to `/opt/bubble/.env`:

```
RATE_LIMIT_AUTH_MAX=1000000
RATE_LIMIT_AUTH_WINDOW_MIN=1
```

then `docker compose up -d api` to apply. **Remove these lines after the weekend** — a real deployment keeps real limits.

### Pointing the existing tools at the cloud

The laptop scripts already accept a remote target. From the repo on whichever driver:

```bash
BASE_URL=https://bubble.<your-domain> scripts/one-off/hosting-loadtest.sh moderate-usage 5m
```

One difference from laptop runs: the resource sampler inside that script watches *local* Docker, which is now the wrong machine. Sample the server from a separate terminal instead:

```bash
ssh root@$BUBBLE_IP 'while true; do docker stats --no-stream \
  --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"; sleep 5; done' | tee remote-resources.tsv
```

## The adjusted test matrix

Durations are cut from the laptop plan's 10 minutes to 5 — on a quiet dedicated server, 5 minutes of steady state is plenty, and it halves the wall-clock and the bytes. Total plan: **~75 minutes of runs, well under 10 GB of transfer, ≈ $0 in bandwidth.**

| # | Run | Command (from the driver) | Duration | What it establishes |
|---|---|---|---|---|
| 1 | Baseline latency, no load | `curl -w '%{time_total}\n' -o /dev/null -s https://$BUBBLE_HOST/api/v1/ping` ×20 | 1 min | Real-internet floor for response times |
| 2 | Moderate scenario | `BASE_URL=… hosting-loadtest.sh moderate-usage 5m` | 5 min | Sanity pass; confirms tooling |
| 3 | Insane scenario | `BASE_URL=… hosting-loadtest.sh insane-usage 5m` | 5 min | The headline: does 52 req/s stay boring on real hardware? |
| 4 | Ceiling probe | `BASE_URL=… hosting-loadtest.sh headroom 5m` | 5 min | Where the single server actually tops out |
| 5 | **Image-traffic sample** (the laptop gap) | curl loop below, from the **cloud driver** | 5 min | Real bytes per screen-load of images — the missing egress input |
| 6 | Soak | `BASE_URL=… hosting-loadtest.sh insane-usage 60m` | 1 hr, unattended | Memory creep / slow-leak check while you do something else |

### The image-traffic sample (run #5), concretely

Measure one cold load of the category grid — every category image, byte-counted, cache ignored:

```bash
# list the category image URLs from the seeded API, then fetch each once and sum bytes
TOTAL=0
for url in $(curl -fsS https://$BUBBLE_HOST/api/v1/categories | grep -o '"/images/categories/[^"]*"' | tr -d '"' | sort -u); do
  b=$(curl -fsS -o /dev/null -w '%{size_download}' -H 'Cache-Control: no-cache' "https://$BUBBLE_HOST$url")
  TOTAL=$((TOTAL + b)); echo "$b  $url"
done
echo "COLD GRID LOAD: $TOTAL bytes"
```

Repeat a handful of times, note the number (expect ~40 MB pre-fix), and file it as **bytes per cold image view**. That single number × views per user per month × users is the image-egress model — no sustained hammering required. Re-run after the compression/caching fixes to capture the after number (expect ~5 MB once, then near-zero on repeat views).

## Reading the results and turning them into dollars

Collect per run: achieved req/s and failure rate plus response-time percentiles (`k6-summary.json`), peak CPU/memory (`remote-resources.tsv`), and total bytes out. For actual metered transfer, before and after each run:

```bash
ssh root@$BUBBLE_IP 'cat /sys/class/net/eth0/statistics/tx_bytes'   # delta = bytes sent
linode-cli account transfer --text                                   # Linode's own meter (pool used/remaining)
```

Then the arithmetic that makes it a business answer — for each scenario, using [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md)'s activity model:

```
monthly GB = (measured bytes per session-equivalent) × sessions/day × 30.4 ÷ 1e9
Linode $   = max(0, monthly GB − pooled allowance) × $0.005      (≈ $0 in practice)
AWS-class $= max(0, monthly GB − 100) × $0.09
```

**Success criteria** (mirroring the laptop results): zero failures through the insane run; insane-scenario CPU well under one core; response times = baseline latency + single-digit milliseconds; flat memory across the soak; measured egress within ~2× of the model's per-scenario totals. Any miss is worth a note in the research set — that's the point of testing on real hardware.

**Where the real spike risk would be** if results surprise us: not requests (the CPU has 4× headroom) but **per-session image bytes**. If run #5 says a session moves 40+ MB of images, the model's 3 MB/session photo assumption is off by 10×+ — on Linode that still hides in the pool, but it would push the big-three "insane" estimates from ~$120 toward ~$200+/month and argues for doing the image fixes *before* any launch-marketing push, not after.

## Cost of the weekend, itemized

| Item | Rate | Weekend total |
|---|---|---|
| Main server (from the runbook) | $0.036/hr | ~$2.60 |
| Driver Nanode (optional) | $0.0075/hr | ~$0.36 |
| All test bandwidth | inside prorated pool; overage $0.005/GB | ~$0.00 |
| **Total** | | **≈ $3** |

Delete both machines when finished (runbook Phase 13) — a powered-off Linode still bills.
