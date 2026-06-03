#!/bin/zsh
# create_server_windows - Launch Terminal windows in a pyramid layout for development servers.
#
# 

print "nope"
exit 1


##############################################################
# This script doesn't work at all
# several key things seem to have been hallucinated by the LLM
# The title attribute isn't available from Terminal, so the windows_exist() function cannot work
# argument passing is incorrect, and had to be manually patched / defaulted until I lost my mind
# the default commands were wrong, but that's reasonable
# the boundary calculations were never done: the bounds_map has no entries in practice.
# the initial choice of title included === Metro ===, but then the quotes were messed up
# zero osascripts run on first try.
        



set -x



# ----- Configuration -------------------------------------------------
# Desired total area covered by all windows (fraction of screen).
SCREEN_COVERAGE=0.7

# Window margin (pixels) between windows and from screen edges.
MARGIN=10

# Command to run in each terminal (adjust paths and commands as needed).
# Use `exec zsh` to keep the window open after the command finishes.
declare -A COMMANDS
delay=5
COMMANDS[api]='echo Starting API in ${delay} seconds && sleep ${delay} && npm run api_server'
COMMANDS[metro]='echo Starting Metro Bundler in ${delay} seconds && sleep && npm metro_bundler'
COMMANDS[ios]='echo To start iOS App in the simulator, run npm mobile:build:ios-sim'
COMMANDS[android]='echo To start Android App in the emulator, run npm mobile:build:android-emu'
COMMANDS[general]='echo General purpose window. Have a totally excellent day.'

# Colour pairs: background and foreground (RGB components 0-65535).
# Format: "bg_red bg_green bg_blue fg_red fg_green fg_blue"
declare -A COLORS
COLORS[api]="0 0 40000 65535 65535 65535"      # dark blue on white
COLORS[metro]="0 30000 0 65535 65535 65535"    # dark green on white
COLORS[ios]="30000 0 30000 65535 65535 65535"  # purple on white
COLORS[android]="30000 15000 0 65535 65535 65535"  # orange on white
COLORS[general]="20000 20000 20000 65535 65535 65535"  # grey on white

# Order of creation and layout mapping.
WINDOW_ORDER=(api metro ios android general)
# Layout rows: each entry is "title row col_span"
LAYOUT=(
    "api    0 1"
    "metro  0 1"
    "ios    1 1"
    "android 1 1"
    "general 2 2"
)

# based on LAYOUT, the win_boundaries_map will be dynamically computed
declare -A win_boundaries_map

# --------------------------------------------------------------------

# Helper: get screen width and height using Python and AppKit.
get_screen_size() {
    python3 -c "
from AppKit import NSScreen
frame = NSScreen.mainScreen().frame()
print(int(frame.size.width), int(frame.size.height))
" 2>/dev/null
}

# Helper: compute window bounds (x, y, width, height) for a given layout.
compute_bounds() {
    local screen_w=$1 screen_h=$2
    local total_w=$(($screen_w * $SCREEN_COVERAGE))
    local total_h=$(($screen_h * $SCREEN_COVERAGE))

    local col_width=$(( (total_w - $MARGIN) / 2 ))
    local row_height=$(( (total_h - 2 * $MARGIN) / 3 ))

    local -A bounds
    # Row 0 (two windows)
    bounds[api]="$MARGIN $MARGIN $col_width $row_height"
    bounds[metro]="$(( $MARGIN + $col_width + $MARGIN )) $MARGIN $col_width $row_height"
    # Row 1
    local row1_y=$(( $MARGIN + $row_height + $MARGIN ))
    bounds[ios]="$MARGIN $row1_y $col_width $row_height"
    bounds[android]="$(( $MARGIN + $col_width + $MARGIN )) $row1_y $col_width $row_height"
    # Row 2 (single wide)
    local row2_y=$(( $row1_y + $row_height + $MARGIN ))
    local wide_width=$(( 2 * $col_width + $MARGIN ))
    bounds[general]="$MARGIN $row2_y $wide_width $row_height"

    for key in ${(k)bounds}; do
        echo "$key ${bounds[$key]}"
    done
}


# Helper: create a new Terminal window with title, command, fg/bg colours in RGB decimal format, and bounds.
#
create_window() {
    local title="${1:=Title}"
    local cmd="${2:=false}"
    local bg_rgb="${3:=20000 20000 20000}"
    local fg_rgb="${4:=65535 65535 65535}"
    local bounds="${5:=100 100 800 400}"   # "x y width height"

echo "Debug-Omega: CW Args are @ title=${title} @ cmd=${cmd} @ bgrgb=${bg_rgb} @ fgrgb=${fg_rgb} @ bounds=${bounds} @ " | tr '@' "\n"
    
    local x=$(echo $bounds | cut -d' ' -f1)
    local y=$(echo $bounds | cut -d' ' -f2)
    local w=$(echo $bounds | cut -d' ' -f3)
    local h=$(echo $bounds | cut -d' ' -f4)

    # remove tmp files on exit
    tmp_prefix="/tmp/.bst"
    trap "rm -f ${tmp_prefix}* 2>/dev/null " EXIT
    err_file="${tmp_prefix}.stderr.$$"
    out_file="${tmp_prefix}.stdout.$$"

    # AppleScript: create window, set its position/size, colours, and run command.
    osascript -e "
    tell application \"Terminal\"
        set newWindow to do script \"$cmd\"
        set name of newWindow to \"$title\"
        set bounds of newWindow to {$x, $y, $x+$w, $y+$h}
        set current session of newWindow to first session of newWindow
        tell current session of newWindow
            set background color to {$bg_rgb}
            set normal text color to {$fg_rgb}
        end tell
        activate
    end tell
    " 1> ${out_file} 2> ${err_file}

    print debug stdout
    cat -n ${out_file}
    print debug stderr
    cat -n ${err_file}
    print debug end

    if [[ $? -ne 0 ]] ; then
	print -u2 "Failed to create ${title} window."
	cat $err_file
	print debug exit fail
	exit 123 # debug
	return 1
    else
	print debug exit ok
	exit 0 # debug
	return 0
    fi
}

# Helper: reposition existing windows according to current layout.
resize_windows() {
    print -u2 "Sorry, this function does not work yet"
}

# FIXME rework this once other boundary computations are sorted.
# FIXME avoid collision of names

FIXME_resize_windows() {
    # FIXME this was a hallucination from LLM.
    # can use "tput cols" and "tput lines" for current-terminal w,h
    # might be able to use ioreg -lw0
    local screen_info=($(get_screen_size))
    local screen_w=$screen_info[1] screen_h=$screen_info[2]
    local -A bounds_map
    for entry in $(compute_bounds $screen_w $screen_h); do
        key=${entry% *}
        val=${entry#* }
        bounds_map[$key]=$val
    done

    for win in $WINDOW_ORDER; do
        local title=${(C)win}   # Capitalise first letter? Actually keep as "api" -> "api"
        # Map "api" to "API Server" etc. for title matching.
        local pretty_name
        case $win in
            api) pretty_name="API Server" ;;
            metro) pretty_name="Metro Bundler" ;;
            ios) pretty_name="iOS App" ;;
            android) pretty_name="Android App" ;;
            general) pretty_name="General" ;;
        esac
        local bounds="${bounds_map[$win]}"
        if [[ -z "$bounds" ]]; then
            echo "No bounds for $win – skipping."
            continue
        fi
        local x=$(echo $bounds | cut -d' ' -f1)
        local y=$(echo $bounds | cut -d' ' -f2)
        local w=$(echo $bounds | cut -d' ' -f3)
        local h=$(echo $bounds | cut -d' ' -f4)

        osascript -e "
        tell application \"Terminal\"
            repeat with wnd in windows
                if name of wnd contains \"$pretty_name\" then
                    set bounds of wnd to {$x, $y, $x+$w, $y+$h}
                    exit repeat
                end if
            end repeat
        end tell
        " 2>/dev/null
    done
    echo "Resized existing windows to original layout."
}

# ----- Main ----------------------------------------------------------
# Resize mode
if [[ -z "$1" ]] ; then
    cmd="all"
else
    cmd="$1"
fi

if [[ "$cmd" == "resize" ]]; then
    resize_windows
    exit 0
fi

# Single-window mode
if [[ "$cmd" != "all" && "$cmd" != "resize" ]]; then
    target="$1"
    # Validate target
    if [[ ! " ${WINDOW_ORDER[@]} " =~ " ${target} " ]]; then
        echo "Unknown window name. Valid names: ${WINDOW_ORDER[@]}"
        exit 1
    fi
    # Compute current screen size and bounds for all windows, then only for target.
    screen_info=($(get_screen_size))
    if [[ ${#screen_info[@]} -ne 2 ]]; then
        echo "Could not detect screen size. Using fallback 1440x900."
        screen_info=(1440 900)
    fi
    screen_w=$screen_info[1] screen_h=$screen_info[2]
    bounds_map=()
    for entry in $(compute_bounds $screen_w $screen_h); do
        key=${entry% *}
        val=${entry#* }
        bounds_map[$key]=$val
    done
    bg_fg=(${=COLORS[$target]})
    bg_rgb="${bg_fg[1]} ${bg_fg[2]} ${bg_fg[3]}"
    fg_rgb="${bg_fg[4]} ${bg_fg[5]} ${bg_fg[6]}"
    pretty_title=$(echo "$target" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
    case $target in
        api) pretty_title="API Server" ;;
        metro) pretty_title="Metro Bundler" ;;
        ios) pretty_title="iOS App" ;;
        android) pretty_title="Android App" ;;
        general) pretty_title="General" ;;
    esac
    echo Debug-alpha @ "$pretty_title" @ "${COMMANDS[$target]}" @ "$bg_rgb" @ "$fg_rgb" @ "${bounds_map[$target]}" @ | tr '@' "\n"
    create_window "$pretty_title" "${COMMANDS[$target]}" "$bg_rgb" "$fg_rgb" "${bounds_map[$target]}"
    exit 0
fi

# Full creation mode (no arguments)
screen_info=($(get_screen_size))
if [[ ${#screen_info[@]} -ne 2 ]]; then
    echo "Warning: could not detect screen size. Using fallback 1440x900."
    screen_info=(1440 900)
fi
screen_w=$screen_info[1] screen_h=$screen_info[2]

# Compute bounds for each window
for entry in $(compute_bounds $screen_w $screen_h); do
    key=${entry% *}
    val=${entry#* }
    bounds_map[$key]=$val
    print debug received entry = ${entry}
    print debug received key = ${key}
    print debug received val = ${val}
    print debug ${bounds_map}

done

# Create each window in order
win_errors_seen=0
for win in $WINDOW_ORDER; do
    # Pretty title and mapping
    pretty_title=$(echo "$win" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
    case $win in
        api) pretty_title="API Server" ;;
        metro) pretty_title="Metro Bundler" ;;
        ios) pretty_title="iOS App" ;;
        android) pretty_title="Android App" ;;
        general) pretty_title="General" ;;
    esac
    bg_fg=(${=COLORS[$win]})
    bg_rgb="${bg_fg[1]} ${bg_fg[2]} ${bg_fg[3]}"
    fg_rgb="${bg_fg[4]} ${bg_fg[5]} ${bg_fg[6]}"
    cmd="${COMMANDS[$target]}:false"	# there doesn't have to be a command for a window
    bounds="${bounds_map[$target]}"
    if test -z "${bounds}" ; then
	echo "there's your problem, sir. target = [${target}] win = [${win}]" # debug
	bounds="${bounds_map[$win]}"
	test -z ${bounds} && echo dammit bounds is null || echo dammit bounds is ${bounds}
	print ${bounds_map}
	exit 123
    fi
    echo Debug-beta @ "${pretty_title}" @ ${cmd:=false} @ "${bg_rgb}" @ "${fg_rgb}" @ "${bounds}" @ | tr '@' "\n"
    create_window "$pretty_title" "${COMMANDS[$win]}" "$bg_rgb" "$fg_rgb" "${bounds_map[$win]}"
    if [[ $? -ne 0 ]] ; then
	print -u2 "Couldn't create ${pretty_title}"
	win_errors_seen=1
    fi;

    sleep 0.5   # small delay to avoid overlapping creation conflicts
done

if [[ ${win_errors_seen} -eq 0 ]]; then
   print "All windows created. Use '$0 resize' to reposition them later."
   exit 0
else
   print -u2 "Not all windows were created."
   exit 1
fi

