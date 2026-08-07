#!/usr/bin/env zsh
# review_scripts.zsh - grep-like reader over the docs/script/*-analysis.json reports.
#
# The analysis files have unique field names across the `objective` and
# `subjective` sections, so any field is addressable by a single switch whose
# name is the field in kebab-case (e.g. --change-score -> change_score). Lookup
# is recursive, so the section a field lives in does not matter.
#
# USAGE
#   review_scripts [--field ...] <target> [<target> ...]
#
#   <target> may be:
#     - a script path        (scripts/foo.py, tests/runner/qa.ts, scripts/dev-connect.sh)
#     - an analysis file      (docs/script/foo-analysis.json)
#     - a bare script/base name (foo, qa, dev-connect)
#   Globs work: `review_scripts --name --purpose scripts/*`.
#
#   Switches are field names with `--` and dashes, e.g.:
#     --name --purpose --change-score --quality-score --external-dependency-score
#     --side-effects --switches --linux-changes-needed --destructive-steps ...
#   `--quality` is accepted as an alias for `--quality-score`.
#
# DEFAULTS
#   With NO field switches, prints: --name --purpose --change-score --quality-score
#
# OUTPUT
#   Grep-like, NOT valid JSON. One block per target:
#     === <name> (<analysis-file>) ===
#     <field>: <value>
#   Scalars print inline; arrays/objects pretty-print indented.
#
# REQUIRES: jq

set -u
emulate -L zsh
setopt no_nomatch            # let globbed targets that miss simply pass through
DOCDIR="${REVIEW_SCRIPTS_DOCDIR:-docs/script}"

if ! command -v jq >/dev/null 2>&1; then
  print -u2 "review_scripts: jq not found on PATH"; exit 3
fi

# Colorize nested JSON only on an interactive terminal; stay plain when piped to
# a file or an aggregator so escape codes do not pollute the output.
typeset jq_color="-M"
[[ -t 1 ]] && jq_color="-C"

# --- parse args: switches (start with --) vs targets ------------------------
typeset -a fields targets
for a in "$@"; do
  case "$a" in
    -h|--help)
      sed -n '2,33p' "$0"; exit 0 ;;
    --*)
      fields+=("${a#--}") ;;
    *)
      targets+=("$a") ;;
  esac
done

if (( ${#targets} == 0 )); then
  print -u2 "review_scripts: no target given. Try: review_scripts --name scripts/*"
  print -u2 "                (or: review_scripts --help)"
  exit 2
fi

# default field set when none requested
if (( ${#fields} == 0 )); then
  fields=(name purpose change-score quality-score)
fi

# kebab-switch -> json key (snake_case); apply known aliases
to_key() {
  local k="${1//-/_}"
  case "$k" in
    quality) k="quality_score" ;;
  esac
  print -r -- "$k"
}

# map an arbitrary target to its analysis file (echo path, or empty if none)
resolve_analysis() {
  local t="$1" base
  if [[ "$t" == *-analysis.json ]]; then
    [[ -f "$t" ]] && { print -r -- "$t"; return 0; }
    [[ -f "$DOCDIR/${t:t}" ]] && { print -r -- "$DOCDIR/${t:t}"; return 0; }
    return 1
  fi
  base="${t:t}"                     # basename
  base="${base%.py}"; base="${base%.ts}"; base="${base%.zsh}"; base="${base%.sh}"
  if [[ -f "$DOCDIR/${base}-analysis.json" ]]; then
    print -r -- "$DOCDIR/${base}-analysis.json"; return 0
  fi
  return 1
}

# Recursively find one key in a JSON file and print a tagged result:
#   first line is MISS | SCALAR | JSON; for SCALAR/JSON the value follows.
emit_field() {
  local file="$1" key="$2"
  jq -r --arg k "$key" '
    [ paths as $p | select(($p|length>0) and ($p[-1]==$k)) | getpath($p) ] as $hits
    | if ($hits|length)==0 then "MISS"
      else $hits[0]
        | if (type=="string" or type=="number" or type=="boolean" or .==null)
          then "SCALAR\n" + (if .==null then "null" else tostring end)
          else "JSON\n" + (.|tojson)
          end
      end
  ' "$file" 2>/dev/null
}

typeset -i missing_targets=0 matched_targets=0
for t in "${targets[@]}"; do
  af="$(resolve_analysis "$t")"
  if [[ -z "$af" ]]; then
    print -u2 "review_scripts: no analysis file for '$t' (looked in $DOCDIR)"
    missing_targets+=1
    continue
  fi
  matched_targets+=1
  name="$(jq -r '.objective.name // .name // "?"' "$af" 2>/dev/null)"
  print -r -- "=== ${name} (${af}) ==="
  for fsw in "${fields[@]}"; do
    key="$(to_key "$fsw")"
    out="$(emit_field "$af" "$key")"
    tag="${out%%$'\n'*}"           # first line
    val="${out#*$'\n'}"           # remainder
    case "$tag" in
      MISS)   print -r -- "${fsw}: (no such field)" ;;
      SCALAR) print -r -- "${fsw}: ${val}" ;;
      JSON)   print -r -- "${fsw}:"
              print -r -- "$val" | jq $jq_color . 2>/dev/null | sed 's/^/    /' ;;
      *)      print -r -- "${fsw}: (lookup error)" ;;
    esac
  done
  print -r --
done

# Fail only when nothing matched at all (so globs over mixed dirs stay quiet on
# stdout but still succeed if at least one analysis file was found).
(( matched_targets == 0 )) && exit 1
exit 0
