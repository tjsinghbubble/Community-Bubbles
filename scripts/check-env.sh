#!/usr/bin/env bash
# check-env.sh — Bubble developer environment checker
# Usage: ./scripts/check-env.sh [--help] [--env] [--verbose] [--fix]

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Disable colour if not a terminal
if [[ ! -t 1 ]]; then
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' RESET=''
fi

# ── Flags ─────────────────────────────────────────────────────────────────────
OPT_HELP=false
OPT_ENV=false
OPT_VERBOSE=false
OPT_FIX=false

for arg in "$@"; do
  case "$arg" in
    -h|--help)    OPT_HELP=true ;;
    -e|--env)     OPT_ENV=true ;;
    -v|--verbose) OPT_VERBOSE=true ;;
    -f|--fix)     OPT_FIX=true ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
done

# ── Help ──────────────────────────────────────────────────────────────────────
if $OPT_HELP; then
  cat <<'HELP'
check-env.sh — Bubble developer environment checker

Usage:
  ./scripts/check-env.sh [options]

Options:
  -h, --help      Show this help and exit
  -e, --env       Show env var details (secret values are redacted)
  -v, --verbose   Show extra detail for passing checks
  -f, --fix       Auto-fix where possible:
                    • brew install missing tools
                    • chmod ~/.ssh to 700
                    • Add alias gh='github' to ~/.zshrc
                    • Create ~/.bubble_secrets from template
                    • Add sourcing of ~/.bubble_secrets to ~/.zshrc
                    • Append missing PATH entries to ~/.zshrc

Exit codes:
  0   All required checks passed (warnings may still exist)
  1   One or more required checks failed

Sections checked:
  1. Required programs (python3, brew, node, npm, npx, watchman, psql, gh)
  2. Optional programs (Maestro, Xcode, Maestro Studio, Android Studio, Docker)
  3. GitHub SSH authentication
  4. PATH configuration
  5. .bubble_secrets file
  6. Environment variables

HELP
  exit 0
fi

# ── Counters ──────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0

# ── Output helpers ────────────────────────────────────────────────────────────
pass()    { PASS=$((PASS + 1));   printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
fail()    { FAIL=$((FAIL + 1));   printf "  ${RED}✗${RESET} %s\n" "$1"; }
warn()    { WARN=$((WARN + 1));   printf "  ${YELLOW}⚠${RESET} %s\n" "$1"; }
info()    {                       printf "    ${CYAN}→${RESET} %s\n" "$1"; }
verbose() { $OPT_VERBOSE &&       printf "    ${BLUE}·${RESET} %s\n" "$1" || true; }
section() { printf "\n${BOLD}${BLUE}══ %s ══${RESET}\n" "$1"; }
sub()     { printf "\n  ${BOLD}%s${RESET}\n" "$1"; }

# ── Portability helpers ───────────────────────────────────────────────────────
# Returns octal permission bits (e.g. "700") for a path
file_perms() {
  if stat -f "%Lp" "$1" &>/dev/null; then
    stat -f "%Lp" "$1"       # macOS
  else
    stat -c "%a"  "$1"       # Linux / GNU coreutils
  fi
}
file_owner() {
  if stat -f "%Su" "$1" &>/dev/null; then
    stat -f "%Su" "$1"
  else
    stat -c "%U"  "$1"
  fi
}

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_FILE="$HOME/.bubble_secrets"
ZSHRC="$HOME/.zshrc"
CURRENT_USER="$(id -un)"

# Source .bubble_secrets early so env-var checks see its exports
if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$SECRETS_FILE" 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────────────────────
# 1. REQUIRED PROGRAMS
# ─────────────────────────────────────────────────────────────────────────────
section "Required Programs"

# python3 — prerequisite for many tools; no auto-fix (ships with Xcode CLT)
if command -v python3 &>/dev/null; then
  pass "python3  ($(python3 --version 2>&1))"
else
  fail "python3 not found"
  info "Install Xcode Command Line Tools: xcode-select --install"
fi

# brew — no auto-fix; everything else depends on it
if command -v brew &>/dev/null; then
  pass "brew  ($(brew --version 2>/dev/null | head -1))"
else
  fail "Homebrew not found — most other tools require it"
  info 'Install: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
fi

# Helper: check a brew-managed CLI tool; optionally auto-install
brew_tool() {
  local cmd="$1" pkg="${2:-$1}" hint="${3:-}"
  if command -v "$cmd" &>/dev/null; then
    local ver
    ver=$("$cmd" --version 2>/dev/null | head -1 || echo "unknown version")
    pass "$cmd  ($ver)"
    verbose "$(command -v "$cmd")"
  else
    fail "$cmd not found"
    if $OPT_FIX && command -v brew &>/dev/null; then
      info "Running: brew install $pkg"
      if brew install "$pkg"; then
        pass "$cmd installed via brew"
      else
        warn "brew install $pkg failed — install manually"
      fi
    else
      info "Fix: brew install $pkg${hint:+  # $hint}"
    fi
  fi
}

brew_tool node      node
brew_tool npm       node    "installed with node"
brew_tool npx       node    "installed with node"
brew_tool watchman  watchman
brew_tool psql      "postgresql@16"

# gh / github — special handling: support alias
if command -v gh &>/dev/null; then
  pass "gh  ($(gh --version 2>/dev/null | head -1 || echo "?"))"
  verbose "$(command -v gh)"
elif command -v github &>/dev/null; then
  warn "GitHub CLI found as 'github' but not aliased as 'gh'"
  if $OPT_FIX; then
    info "Adding alias gh='github' to $ZSHRC"
    { echo ""; echo "# Bubble: gh alias"; echo "alias gh='github'"; } >> "$ZSHRC"
    pass "Alias added — run: source $ZSHRC"
  else
    info "Fix: add to ~/.zshrc:  alias gh='github'"
    info "  OR: ln -sf \$(which github) /usr/local/bin/gh"
  fi
else
  fail "gh (GitHub CLI) not found"
  if $OPT_FIX && command -v brew &>/dev/null; then
    info "Running: brew install gh"
    brew install gh && pass "gh installed via brew" || warn "brew install gh failed"
  else
    info "Fix: brew install gh  (then run: gh auth login)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. OPTIONAL PROGRAMS
# ─────────────────────────────────────────────────────────────────────────────
section "Optional Programs"

# Maestro — required for E2E tests; manual install only
if command -v maestro &>/dev/null; then
  pass "Maestro  ($(maestro --version 2>/dev/null | head -1 || echo "?"))"
else
  warn "Maestro not found — required for E2E tests"
  info 'Install: curl -fsSL "https://get.maestro.mobile.dev" | bash'
  info "Then add ~/.maestro/bin to PATH (see PATH section below)"
fi

# Maestro Studio — ships as a sub-command of Maestro
if command -v maestro &>/dev/null; then
  # maestro studio --help exits 0 on supported builds
  if maestro studio --help &>/dev/null 2>&1; then
    pass "Maestro Studio  (bundled with Maestro)"
  else
    warn "Maestro Studio not available — update Maestro to the latest version"
  fi
else
  warn "Maestro Studio  (not available — install Maestro first)"
fi

# Xcode Command Line Tools
if xcode-select -p &>/dev/null 2>&1; then
  pass "Xcode Command Line Tools  ($(xcode-select -p))"
else
  warn "Xcode Command Line Tools not installed"
  info "Install: xcode-select --install"
fi

# Full Xcode.app — required for native iOS builds and simulators
if [[ -d "/Applications/Xcode.app" ]]; then
  XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 || echo "?")
  pass "Xcode.app  ($XCODE_VER)"
  # iOS simulators
  SIM_COUNT=$(xcrun simctl list devices available 2>/dev/null | grep -c "iPhone" || echo 0)
  if [[ "$SIM_COUNT" -gt 0 ]]; then
    pass "iOS Simulators  ($SIM_COUNT iPhone simulator(s) available)"
  else
    warn "No iOS Simulators found"
    info "Add one: Xcode → Settings → Platforms → iOS → +"
  fi
else
  warn "Xcode.app not installed — required for native iOS builds (mobile:build:ios-sim)"
  info "Install: https://developer.apple.com/xcode/  or via the App Store"
  info "Note: iOS Simulators are bundled with Xcode.app"
fi

# Android Studio — optional
if [[ -d "/Applications/Android Studio.app" ]]; then
  pass "Android Studio  (/Applications/Android Studio.app)"
else
  warn "Android Studio not found — optional (needed for Android builds)"
  info "Install: https://developer.android.com/studio"
fi

# Docker — optional; comment-only
if command -v docker &>/dev/null; then
  pass "Docker  ($(docker --version 2>/dev/null | head -1))"
else
  warn "Docker not found — optional (used for local infrastructure)"
  info "Install: https://www.docker.com/products/docker-desktop"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. GITHUB SSH AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────
section "GitHub SSH Authentication"

SSH_DIR="$HOME/.ssh"

if [[ -d "$SSH_DIR" ]]; then
  pass "~/.ssh directory exists"

  # Permissions must be 700
  SSH_PERMS=$(file_perms "$SSH_DIR")
  if [[ "$SSH_PERMS" == "700" ]]; then
    pass "~/.ssh permissions  (700)"
  else
    fail "~/.ssh permissions are $SSH_PERMS — must be 700"
    if $OPT_FIX; then
      chmod 700 "$SSH_DIR"
      pass "Fixed: chmod 700 ~/.ssh"
    else
      info "Fix: chmod 700 ~/.ssh"
    fi
  fi

  # Ownership
  SSH_OWNER=$(file_owner "$SSH_DIR")
  if [[ "$SSH_OWNER" == "$CURRENT_USER" ]]; then
    pass "~/.ssh owned by $CURRENT_USER"
  else
    fail "~/.ssh owned by $SSH_OWNER — expected $CURRENT_USER"
    info "Fix: sudo chown -R $CURRENT_USER ~/.ssh"
  fi
else
  fail "~/.ssh directory does not exist"
  if $OPT_FIX; then
    mkdir -m 700 "$SSH_DIR"
    pass "Created ~/.ssh with permissions 700"
  else
    info "Fix: mkdir -m 700 ~/.ssh"
  fi
fi

# ~/.ssh/config
if [[ -f "$SSH_DIR/config" ]]; then
  pass "~/.ssh/config exists"
  if grep -q "github.com" "$SSH_DIR/config" 2>/dev/null; then
    pass "~/.ssh/config has a github.com Host entry"
  else
    warn "~/.ssh/config exists but has no github.com Host entry"
    info "Add to ~/.ssh/config:"
    info "  Host github.com"
    info "    HostName github.com"
    info "    User git"
    info "    IdentityFile ~/.ssh/id_ed25519"
  fi
else
  warn "~/.ssh/config not found"
  info "Create ~/.ssh/config with a github.com Host entry (see above)"
fi

# Public key files
PUB_KEY_COUNT=$(find "$SSH_DIR" -maxdepth 1 -name "*.pub" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$PUB_KEY_COUNT" -gt 0 ]]; then
  pass "SSH public key(s) found  ($PUB_KEY_COUNT file(s))"
  if $OPT_VERBOSE; then
    find "$SSH_DIR" -maxdepth 1 -name "*.pub" -exec printf "    ${BLUE}·${RESET} %s\n" {} \;
  fi
else
  fail "No SSH public keys found in ~/.ssh (*.pub)"
  info 'Generate: ssh-keygen -t ed25519 -C "your@email.com"'
  info 'Then add to GitHub: gh ssh-key add ~/.ssh/id_ed25519.pub --title "My Mac"'
fi

# Live SSH test
info "Testing SSH connection to github.com …"
SSH_OUT=$(ssh -T git@github.com -o ConnectTimeout=10 -o BatchMode=yes 2>&1 || true)
if echo "$SSH_OUT" | grep -q "successfully authenticated"; then
  GH_HANDLE=$(echo "$SSH_OUT" | sed 's/.*Hi \([^!]*\)!.*/\1/')
  pass "GitHub SSH authenticated  (user: $GH_HANDLE)"
elif echo "$SSH_OUT" | grep -qi "permission denied"; then
  fail "GitHub SSH — permission denied"
  info "Your key may not be added to GitHub: gh ssh-key list"
  info "Add it: https://github.com/settings/keys"
elif echo "$SSH_OUT" | grep -Eqi "timed out|no route to host|network"; then
  fail "GitHub SSH — connection failed (check network/firewall)"
else
  warn "GitHub SSH — unexpected response: $SSH_OUT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. PATH CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
section "PATH Configuration"

# Expected directories that must be on PATH for the dev environment
declare -a PATH_DIRS=(
  "/opt/homebrew/bin"      # Homebrew on Apple Silicon
  "/usr/local/bin"         # Homebrew on Intel  /  manually installed tools
  "$HOME/.maestro/bin"     # Maestro CLI
)

PATH_FIX_NEEDED=false

for dir in "${PATH_DIRS[@]}"; do
  # Check if dir exists on this machine (skip if it doesn't exist at all)
  if [[ ! -d "$dir" ]]; then
    verbose "$dir — not present on this machine, skipping"
    continue
  fi
  if echo "$PATH" | tr ':' '\n' | grep -qx "$dir"; then
    pass "PATH includes $dir"
  else
    warn "$dir exists but is not in PATH"
    PATH_FIX_NEEDED=true
    if $OPT_FIX && [[ -f "$ZSHRC" ]]; then
      info "Adding to $ZSHRC: export PATH=\"$dir:\$PATH\""
      { echo ""; echo "# Bubble: PATH addition"; echo "export PATH=\"$dir:\$PATH\""; } >> "$ZSHRC"
      pass "Added $dir to PATH in $ZSHRC (run: source $ZSHRC)"
    else
      info "Add to ~/.zshrc: export PATH=\"$dir:\$PATH\""
    fi
  fi
done

if $PATH_FIX_NEEDED && ! $OPT_FIX; then
  info "Run with --fix to patch ~/.zshrc automatically"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. .bubble_secrets FILE
# ─────────────────────────────────────────────────────────────────────────────
section ".bubble_secrets File"

# Template written by --fix or shown as guidance
read -r -d '' SECRETS_TEMPLATE <<'TEMPLATE' || true
# ~/.bubble_secrets — Bubble developer secrets
# Sourced by ~/.zshrc — DO NOT commit this file.

# ── Server ────────────────────────────────────────────────────────────────────
export DATABASE_URL="postgres://localhost/bubble"
export JWT_SECRET="change-me-to-a-random-secret"
export ENCRYPTION_KEY="change-me-32-chars-long-exactly!!"
export PORT=3000

# ── CometChat (get credentials from the CometChat dashboard) ─────────────────
export COMETCHAT_APP_ID=""
export COMETCHAT_REGION="us"
export COMETCHAT_AUTH_KEY=""
export COMETCHAT_API_KEY=""

# ── Sentry (optional — omit or leave blank to disable) ───────────────────────
# export SENTRY_DSN=""
# export BUBBLE_SENTRY_USAGE="local"    # enables Sentry in local dev

# ── Mobile usage flags (optional) ────────────────────────────────────────────
# export BUBBLE_COMETCHAT_USAGE="local"

# ── Email (optional) ──────────────────────────────────────────────────────────
# export RESEND_API_KEY=""
# export EMAIL_FROM="noreply@yourdomain.com"
TEMPLATE

if [[ -f "$SECRETS_FILE" ]]; then
  pass ".bubble_secrets exists"

  # Must not be a symlink
  if [[ -L "$SECRETS_FILE" ]]; then
    fail ".bubble_secrets is a symlink — must be a real file"
    info "Fix: unlink ~/.bubble_secrets && cp /real/source ~/.bubble_secrets"
  else
    pass ".bubble_secrets is a regular file"
  fi

  # Ownership
  SEC_OWNER=$(file_owner "$SECRETS_FILE")
  if [[ "$SEC_OWNER" == "$CURRENT_USER" ]]; then
    pass ".bubble_secrets owned by $CURRENT_USER"
  else
    fail ".bubble_secrets owned by $SEC_OWNER — expected $CURRENT_USER"
    info "Fix: sudo chown $CURRENT_USER ~/.bubble_secrets"
  fi

  # Permissions — accept 600 or 700 (not readable by others)
  SEC_PERMS=$(file_perms "$SECRETS_FILE")
  if [[ "$SEC_PERMS" == "600" || "$SEC_PERMS" == "700" ]]; then
    pass ".bubble_secrets permissions  ($SEC_PERMS)"
  else
    fail ".bubble_secrets permissions are $SEC_PERMS — should be 600"
    if $OPT_FIX; then
      chmod 600 "$SECRETS_FILE"
      pass "Fixed: chmod 600 ~/.bubble_secrets"
    else
      info "Fix: chmod 600 ~/.bubble_secrets"
    fi
  fi
else
  warn ".bubble_secrets not found"
  if $OPT_FIX; then
    printf '%s\n' "$SECRETS_TEMPLATE" > "$SECRETS_FILE"
    chmod 600 "$SECRETS_FILE"
    pass "Created ~/.bubble_secrets from template — edit it with your credentials"
    info "\$EDITOR ~/.bubble_secrets"
  else
    info "Create ~/.bubble_secrets with your local secrets (use --fix to generate a template)"
  fi
fi

# .zshrc sources .bubble_secrets
if [[ -f "$ZSHRC" ]]; then
  if grep -q "bubble_secrets" "$ZSHRC" 2>/dev/null; then
    pass ".zshrc sources .bubble_secrets"
  else
    fail ".zshrc does not source .bubble_secrets"
    if $OPT_FIX; then
      { echo ""; echo "# Bubble: source developer secrets"; \
        echo '[[ -f ~/.bubble_secrets ]] && source ~/.bubble_secrets'; } >> "$ZSHRC"
      pass "Added sourcing of .bubble_secrets to $ZSHRC"
      info "Run: source $ZSHRC"
    else
      info "Add to ~/.zshrc:  [[ -f ~/.bubble_secrets ]] && source ~/.bubble_secrets"
    fi
  fi
else
  warn "~/.zshrc not found — .bubble_secrets won't be auto-sourced in new shells"
  info "Create ~/.zshrc and add: [[ -f ~/.bubble_secrets ]] && source ~/.bubble_secrets"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. ENVIRONMENT VARIABLES
# ─────────────────────────────────────────────────────────────────────────────
section "Environment Variables"
if ! $OPT_ENV; then
  printf "  (use -e / --env to show values; secret values are always redacted)\n"
fi

# check_var <NAME> <required|optional> [description]
check_var() {
  local var="$1" required="$2" desc="${3:-}"
  local val="${!var:-}"
  if [[ -n "$val" ]]; then
    local display
    case "$var" in
      *SECRET*|*KEY*|*DSN*|*PASSWORD*|*TOKEN*)
        display="[set — value redacted]" ;;
      *)
        if $OPT_ENV; then
          display="$val"
        else
          display="[set]"
        fi
        ;;
    esac
    pass "$var = $display${desc:+  ($desc)}"
  else
    if [[ "$required" == "required" ]]; then
      fail "$var is not set${desc:+  — $desc}"
    else
      warn "$var is not set  (optional)${desc:+  — $desc}"
    fi
  fi
}

sub "Server"
check_var DATABASE_URL   required "PostgreSQL connection string"
check_var JWT_SECRET     required "Session token signing key"
check_var ENCRYPTION_KEY required "Data encryption key (32+ chars)"
check_var PORT           optional "API port (default: 3000)"

sub "CometChat"
check_var COMETCHAT_APP_ID   required "CometChat application ID"
check_var COMETCHAT_REGION   required "CometChat region (e.g. 'us')"
check_var COMETCHAT_AUTH_KEY required "CometChat auth key"
check_var COMETCHAT_API_KEY  optional "CometChat API key (server-to-server)"

sub "Sentry"
check_var SENTRY_DSN          optional "Sentry DSN — omit to disable Sentry"
check_var BUBBLE_SENTRY_USAGE optional "Set to 'local' to enable Sentry in dev"

sub "Mobile / Feature Flags"
check_var BUBBLE_COMETCHAT_USAGE optional "Set to 'local' to enable CometChat in dev"

sub "Email"
check_var RESEND_API_KEY optional "Resend API key for transactional email"
check_var EMAIL_FROM     optional "Sender address (e.g. noreply@yourdomain.com)"

sub "Node / Build"
check_var NODE_ENV optional "Set automatically by npm scripts (dev/production)"

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
printf "\n${BOLD}${BLUE}══ Summary ══${RESET}\n"
printf "  ${GREEN}✓${RESET} Passed:   %d\n" "$PASS"
[[ $WARN -gt 0 ]] && printf "  ${YELLOW}⚠${RESET} Warnings: %d\n" "$WARN"
[[ $FAIL -gt 0 ]] && printf "  ${RED}✗${RESET} Failed:   %d\n" "$FAIL"

echo

if [[ $FAIL -gt 0 ]]; then
  printf "${RED}${BOLD}%d required check(s) failed.${RESET}\n" "$FAIL"
  if ! $OPT_FIX; then
    printf "Run with ${BOLD}--fix${RESET} to auto-remediate where possible.\n"
  fi
  exit 1
fi

printf "${GREEN}${BOLD}All required checks passed!${RESET}\n"
[[ $WARN -gt 0 ]] && printf "  (%d optional item(s) missing — see warnings above)\n" "$WARN"
exit 0
