#!/usr/bin/env zsh
# trello-card.zsh — create Trello card(s) on the Bubble defects board via the REST API.
#
# Modes:
#   trello-card.zsh --title "..." --list "..." [--desc ...] [--field "Name=Value" ...] [--reviewed]
#   trello-card.zsh --file tmp/trello-cards/foo.md     # one card from a frontmatter+body file
#   trello-card.zsh --dir  tmp/trello-cards            # file every *.md; move filed ones to filed/
# Add --dry-run to preview (parse + show) without writing to Trello.
#
# Auth: TRELLO_API_KEY + TRELLO_TOKEN from env or ~/.bubble_secrets. The token is a generated Trello
# token, NOT the OAuth "Secret". Standing convention: cards get a "(WIP)" title prefix and an
# "Unreviewed by Travis" footer unless --reviewed (or `reviewed: true` in a card file).
#
# Run it as `zsh .../trello-card.zsh ...` so it's covered by the existing Bash(zsh *) allow-rule.
setopt pipe_fail
SKILL_DIR=${0:A:h}

BOARD=${TRELLO_BOARD:-9sHE0OQV}
API="https://api.trello.com/1"
KEY=""; TOK=""; CREDS_READY=0
# Creds are required only for real (non --dry-run) runs, so dry-run review works offline.
ensure_creds() {
  (( CREDS_READY )) && return
  if [[ -z ${TRELLO_API_KEY:-} || -z ${TRELLO_TOKEN:-} ]] && [[ -f ~/.bubble_secrets ]]; then
    source ~/.bubble_secrets
  fi
  : ${TRELLO_API_KEY:?set TRELLO_API_KEY (see .claude/skills/trello/SKILL.md)}
  : ${TRELLO_TOKEN:?set TRELLO_TOKEN — a generated token, NOT the OAuth secret}
  KEY=$TRELLO_API_KEY; TOK=$TRELLO_TOKEN; CREDS_READY=1
}
typeset -A FIELDMAP=(request_type "Request Type" priority "Priority" platform "Platform" menu_item "Menu Item" status "Status")
CF_JSON=""

die() { print -u2 "error: $*"; exit 1; }
usage() { print -u2 "usage: trello-card.zsh (--title T --list L [--desc D] [--field \"Name=Value\"]... | --file F | --dir D) [--reviewed] [--dry-run]"; exit 1; }

# Pull a single-line frontmatter value (split on first colon, so values may contain colons).
get_fm() {  # $1=key $2=file
  awk -v k="$1" '
    /^---[[:space:]]*$/ { c++; next }
    c==1 { i=index($0,":"); if(i>0){ key=substr($0,1,i-1); val=substr($0,i+1);
      gsub(/^[[:space:]]+|[[:space:]]+$/,"",key); gsub(/^[[:space:]]+|[[:space:]]+$/,"",val);
      if(key==k){print val; exit} } }
  ' "$2"
}
get_body() { awk '/^---[[:space:]]*$/{c++; next} c>=2{print}' "$1"; }  # everything after 2nd ---

# Populate TITLE/LIST/DESC/fields/REVIEWED from a card file.
parse_file() {  # $1=file
  local f=$1 v
  [[ -f $f ]] || die "no such card file: $f"
  TITLE=$(get_fm title "$f"); LIST=$(get_fm list "$f"); DESC=$(get_body "$f")
  fields=()
  local fk
  for fk in ${(k)FIELDMAP}; do
    v=$(get_fm "$fk" "$f"); [[ -n $v ]] && fields+=("${FIELDMAP[$fk]}=$v")
  done
  v=$(get_fm reviewed "$f"); [[ $v == (true|yes|1) ]] && REVIEWED=1 || REVIEWED=0
}

create_card() {  # uses TITLE LIST DESC fields REVIEWED DRYRUN
  [[ -n $TITLE ]] || { print -u2 "error: no title"; return 1; }
  [[ -n $LIST  ]] || { print -u2 "error: no list";  return 1; }
  local title=$TITLE desc=$DESC
  if (( ! REVIEWED )); then
    title="(WIP) $title"
    desc="${desc}"$'\n\n---\nUnreviewed by Travis'
  fi
  if (( DRYRUN )); then
    print "DRY-RUN  '$title'  ->  list '$LIST'"
    local s; for s in "${fields[@]}"; do print "         field: $s"; done
    print "         desc: ${#desc} chars"
    return 0
  fi
  ensure_creds
  # Resolve list name -> id (pass-through for a 24-hex id).
  local list_id
  if [[ $LIST =~ '^[0-9a-fA-F]{24}$' ]]; then list_id=$LIST
  else
    list_id=$(curl -fsS "$API/boards/$BOARD/lists?key=$KEY&token=$TOK" \
      | node -e 'const ls=JSON.parse(require("fs").readFileSync(0,"utf8"));const n=process.argv[1].toLowerCase();const m=Array.isArray(ls)&&ls.find(l=>(l.name||"").toLowerCase()===n);process.stdout.write(m?m.id:"")' "$LIST")
    [[ -n $list_id ]] || { print -u2 "error: list '$LIST' not found on $BOARD"; return 1; }
  fi
  # Create the card.
  local resp card_id short
  resp=$(curl -fsS -X POST "$API/cards" \
    --data-urlencode "key=$KEY" --data-urlencode "token=$TOK" \
    --data-urlencode "idList=$list_id" \
    --data-urlencode "name=$title" --data-urlencode "desc=$desc") || { print -u2 "error: create POST failed"; return 1; }
  card_id=$(print -r -- "$resp" | node -e 'process.stdout.write((JSON.parse(require("fs").readFileSync(0,"utf8")).id)||"")')
  short=$(print -r -- "$resp" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(c.shortUrl||c.url||"")')
  [[ -n $card_id ]] || { print -u2 "error: create failed: $resp"; return 1; }
  # Set dropdown custom fields (fetch board defs once).
  if (( ${#fields} )); then
    [[ -n $CF_JSON ]] || CF_JSON=$(curl -fsS "$API/boards/$BOARD/customFields?key=$KEY&token=$TOK")
    local spec pair fid oid
    for spec in "${fields[@]}"; do
      pair=$(print -r -- "$CF_JSON" | node -e '
        const cf=JSON.parse(require("fs").readFileSync(0,"utf8"));
        const s=process.argv[1], i=s.indexOf("=");
        if(i<0){console.error("bad field: "+s);process.exit(2);}
        const fn=s.slice(0,i).trim().toLowerCase(), val=s.slice(i+1).trim().toLowerCase();
        const f=cf.find(x=>(x.name||"").toLowerCase()===fn); if(!f){console.error("field not found: "+s);process.exit(3);}
        const o=(f.options||[]).find(o=>((o.value&&o.value.text)||"").toLowerCase()===val); if(!o){console.error("option not found for: "+s);process.exit(4);}
        process.stdout.write(f.id+" "+o.id);
      ' "$spec") || { print -u2 "  warn: skipping unresolved field: $spec"; continue; }
      fid=${pair%% *}; oid=${pair##* }
      curl -fsS -X PUT "$API/cards/$card_id/customField/$fid/item?key=$KEY&token=$TOK" \
        -H 'Content-Type: application/json' --data "{\"idValue\":\"$oid\"}" >/dev/null \
        && print -u2 "  set: $spec"
    done
  fi
  print "created: $short"
}

# ── args ──────────────────────────────────────────────────────────────────────
MODE=flags; DIR=""; FILE=""; DRYRUN=0; REVIEWED=0
TITLE=""; LIST=""; DESC=""; fields=()
while (( $# )); do
  case $1 in
    --dir) MODE=dir; DIR=$2; shift 2;;
    --file) MODE=file; FILE=$2; shift 2;;
    --title) TITLE=$2; shift 2;;
    --list) LIST=$2; shift 2;;
    --desc) DESC=$2; shift 2;;
    --field) fields+=("$2"); shift 2;;
    --reviewed) REVIEWED=1; shift;;
    --dry-run) DRYRUN=1; shift;;
    -h|--help) usage;;
    *) die "unknown arg: $1";;
  esac
done

case $MODE in
  flags) create_card;;
  file)  parse_file "$FILE"; create_card;;
  dir)
    [[ -d $DIR ]] || die "no dir: $DIR"
    mkdir -p "$DIR/filed"
    setopt null_glob
    found=0
    for f in "$DIR"/*.md(.); do
      found=1
      print "── ${f:t}"
      TITLE=""; LIST=""; DESC=""; fields=(); REVIEWED=0
      parse_file "$f"
      if create_card; then
        (( DRYRUN )) || mv "$f" "$DIR/filed/"
      else
        print -u2 "  (left in place: ${f:t})"
      fi
    done
    (( found )) || print "no *.md card files in $DIR"
    ;;
esac
