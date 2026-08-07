#!/usr/bin/env bash
# hosting-pricing-model.sh — estimate monthly hosting cost per vendor per usage
# scenario. Part of hosting research (docs/research/Move-from-Replit.md); not
# wired into any runner.
#
# Usage:
#   hosting-pricing-model.sh                     # all scenarios, markdown table
#   hosting-pricing-model.sh --scenario low-usage
#   hosting-pricing-model.sh --storage-gb 100    # object storage stored GB (default 50)
#
# Model (deliberately simple; replicate/spot-check against vendor calculators):
#   minimal stack = compute-vm + managed-pg + object storage + egress + IPv4
#   - No LB line: TLS via Caddy/nginx on the VM (see dockerization-plan.md).
#   - Egress GB/mo per scenario from docs/research/usage-scenarios-to-load-model.md
#     (fallback columns; regenerate from measured report.tsv when available).
#   - Vendor quirks (free allowances, bundled transfer, base-fee object storage)
#     are encoded below with comments citing docs/research/pricing/<vendor>.md.
#   - Cloudflare cannot host the stack alone (no VM, no managed PG); it is shown
#     as a hybrid adjunct (Containers API + R2) with PG cost marked n/a.
#
# Unit prices: scripts/one-off/hosting-unit-prices.tsv (from docs/research/pricing/*).

set -euo pipefail
cd "$(dirname "$0")"

SCENARIOS="zero-growth low-usage moderate-usage fast-usage insane-usage"
STORAGE_GB=50
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --scenario) ONLY="$2"; shift 2 ;;
    --storage-gb) STORAGE_GB="$2"; shift 2 ;;
    *) echo "unknown arg $1" >&2; exit 1 ;;
  esac
done
[ -n "$ONLY" ] && SCENARIOS="$ONLY"

# scenario -> total egress GB/mo (API measured 2026-07-03 + object modeled),
# from docs/research/usage-scenarios-to-load-model.md
egress_for() {
  case "$1" in
    zero-growth) echo 2 ;;
    low-usage) echo 6 ;;
    moderate-usage) echo 30 ;;
    fast-usage) echo 60 ;;
    insane-usage) echo 894 ;;
    *) echo "unknown scenario $1" >&2; exit 1 ;;
  esac
}

# price <vendor> <resource_class> -> first matching usd_price
price() {
  awk -F'\t' -v v="$1" -v c="$2" '$1==v && $2==c {print $5; exit}' hosting-unit-prices.tsv
}

echo "# Estimated monthly cost (USD), minimal always-on stack, ${STORAGE_GB} GB object storage"
echo
echo "| scenario | AWS | GCP | Azure | IBM Cloud | Vultr | Akamai/Linode | Cloudflare (hybrid adjunct) |"
echo "|---|---|---|---|---|---|---|---|"

prev_max=0
for s in $SCENARIOS; do
  egress=$(egress_for "$s")
  row="| $s |"

  # --- AWS: 100 GB/mo egress free (pricing/aws.md) ---
  aws=$(awk -v e="$egress" -v st="$STORAGE_GB" \
    -v vm="$(price aws compute-vm)" -v pg="$(price aws managed-pg)" \
    -v os="$(price aws object-storage)" -v eg="$(price aws object-egress)" \
    -v ip="$(price aws public-ipv4)" \
    'BEGIN{be=e-100; if(be<0)be=0; printf "%.0f", vm+pg+st*os+be*eg+ip}')
  row="$row \$$aws |"

  # --- GCP: Standard-tier 200 GB/mo free, then premium rate as ceiling (pricing/gcp.md) ---
  gcp=$(awk -v e="$egress" -v st="$STORAGE_GB" \
    -v vm="$(price gcp compute-vm)" -v pg="$(price gcp managed-pg)" \
    -v os="$(price gcp object-storage)" -v eg="$(price gcp object-egress)" \
    -v ip="$(price gcp public-ipv4)" \
    'BEGIN{be=e-200; if(be<0)be=0; printf "%.0f", vm+pg+st*os+be*eg+ip}')
  row="$row \$$gcp |"

  # --- Azure: 100 GB/mo egress free per subscription (pricing/azure.md) ---
  az=$(awk -v e="$egress" -v st="$STORAGE_GB" \
    -v vm="$(price azure compute-vm)" -v pg="$(price azure managed-pg)" \
    -v os="$(price azure object-storage)" -v eg="$(price azure object-egress)" \
    -v ip="$(price azure public-ipv4)" \
    'BEGIN{be=e-100; if(be<0)be=0; printf "%.0f", vm+pg+st*os+be*eg+ip}')
  row="$row \$$az |"

  # --- IBM Cloud (pricing/ibm-cloud.md) ---
  ibm_vm=$(price ibm-cloud compute-vm); ibm_pg=$(price ibm-cloud managed-pg)
  if [ -n "$ibm_vm" ] && [ -n "$ibm_pg" ]; then
    ibm=$(awk -v e="$egress" -v st="$STORAGE_GB" \
      -v vm="$ibm_vm" -v pg="$ibm_pg" \
      -v os="$(price ibm-cloud object-storage)" -v eg="$(price ibm-cloud object-egress)" \
      -v ip="$(price ibm-cloud public-ipv4)" \
      'BEGIN{be=e; printf "%.0f", vm+pg+st*os+be*eg+ip}') # no free egress allowance assumed; One-Rate alternative in vendor doc
    row="$row \$$ibm |"
  else
    row="$row n/a |"
  fi

  # --- Vultr: VM bundles 3-5 TB transfer; object storage $18 base incl 1 TB;
  #     overage $0.01/GB only beyond pool (pricing/vultr.md). IPv4 incl. w/ VM. ---
  vultr=$(awk -v e="$egress" \
    -v vm="$(price vultr compute-vm)" -v pg="$(price vultr managed-pg)" \
    -v os="$(price vultr object-storage)" -v eg="$(price vultr object-egress)" \
    'BEGIN{be=e-5000; if(be<0)be=0; printf "%.0f", vm+pg+os+be*eg}')
  row="$row \$$vultr |"

  # --- Akamai/Linode: VM bundles 4 TB pooled transfer; object storage $5 base
  #     incl 250 GB + 1 TB transfer; overage $0.005/GB (pricing/akamai-linode.md). ---
  lin=$(awk -v e="$egress" \
    -v vm="$(price akamai-linode compute-vm)" -v pg="$(price akamai-linode managed-pg)" \
    -v os="$(price akamai-linode object-storage)" -v eg="$(price akamai-linode object-egress)" \
    'BEGIN{be=e-5000; if(be<0)be=0; printf "%.0f", vm+pg+os+be*eg}')
  row="$row \$$lin |"

  # --- Cloudflare: hybrid adjunct only — Containers (API) + R2 (photos, zero
  #     egress); Postgres must live elsewhere (pricing/cloudflare.md). ---
  cf=$(awk -v st="$STORAGE_GB" \
    -v cc="$(price cloudflare compute-container)" -v os="$(price cloudflare object-storage)" \
    'BEGIN{printf "%.0f", cc+st*os}')
  row="$row \$$cf + external PG |"

  echo "$row"

  # monotonicity self-check (costs must not decrease as scenarios grow)
  if [ "$aws" -lt "$prev_max" ]; then
    echo "SELF-CHECK FAILED: $s AWS \$$aws < previous scenario \$$prev_max" >&2
    exit 1
  fi
  prev_max=$aws
done

echo
echo "*Generated by scripts/one-off/hosting-pricing-model.sh on $(date -u +%Y-%m-%d). Spot-check against vendor calculators — see docs/research/pricing/ for sources and caveats. HA/backup upsell not included (single-node PG everywhere; see hosting-pricing-parameters.md for HA deltas).*"
