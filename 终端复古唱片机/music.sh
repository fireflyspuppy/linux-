#!/bin/bash
# ============================================================
#  终端复古唱片机 — Terminal Record Player
#  核心工具: sox (Sound eXchange)
#  辅助工具: jp2a, tput
# ============================================================
set -euo pipefail

# ============================================================
# PATH SETUP
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SONGS_DIR="$SCRIPT_DIR/songs"
CACHE_DIR="$SCRIPT_DIR/cache"
mkdir -p "$CACHE_DIR"

# ============================================================
# TERMINAL SETUP
# ============================================================
COLUMNS=$(tput cols 2>/dev/null || echo 80)
LINES=$(tput lines 2>/dev/null || echo 24)

# ============================================================
# ANSI COLORS
# ============================================================
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[91m'
GREEN='\033[92m'
YELLOW='\033[93m'
CYAN='\033[96m'
MAGENTA='\033[95m'
WHITE='\033[97m'
BG='\033[48;5;232m'

# ============================================================
# GLOBAL STATE
# ============================================================
MODE="sequential"
ENGINE="ffplay"
TARGET=""
PLAYLIST=()
CURRENT=0
SOX_PID=""

# ============================================================
# CLEANUP
# ============================================================
cleanup() {
    [[ -n "${SOX_PID:-}" ]] && kill "$SOX_PID" 2>/dev/null || true
    tput cnorm 2>/dev/null || true
    tput cup "$LINES" 0 2>/dev/null || true
    printf '\033[2J\033[H'
    echo -e "${GREEN}Goodbye.${RESET}"
    exit 0
}
trap cleanup INT TERM

# ============================================================
# DEPENDENCY CHECK
# ============================================================
check_deps() {
    local missing=""
    if ! command -v sox &>/dev/null; then
        missing+="  sox (Sound eXchange) — sudo apt install sox\n"
    fi
    if ! command -v jp2a &>/dev/null; then
        missing+="  jp2a (jpg to ascii) — sudo apt install jp2a\n"
    fi
    if [[ -n "$missing" ]]; then
        echo -e "${RED}Missing dependencies:${RESET}"
        echo -e "$missing"
        echo -e "${YELLOW}Install them and try again.${RESET}"
        exit 1
    fi
}

# ============================================================
# UTILITY: convert LRC timestamp to integer seconds
# ============================================================
ts_to_sec() {
    # "00:05.20" -> 5
    local ts="$1"
    ts="${ts//[\[\]]/}"
    local min="${ts%%:*}"
    local sec="${ts##*:}"
    sec="${sec%%.*}"
    echo $(( 10#$min * 60 + 10#$sec ))
}

sec_to_ts() {
    local s="$1"
    printf "%02d:%02d" $(( s / 60 )) $(( s % 60 ))
}

# Truncate string to max visual width (wide chars = 2 cols, ASCII = 1 col)
trunc_visual() {
    local str="$1" maxw="$2" out="" w=0
    local i ch byte
    for ((i=0; i<${#str}; i++)); do
        ch="${str:$i:1}"
        byte=$(printf "%d" "'$ch")
        if [[ $byte -gt 127 ]]; then
            w=$((w + 2))
        else
            w=$((w + 1))
        fi
        [[ $w -gt $maxw ]] && { out+="…"; break; }
        out+="$ch"
    done
    echo "$out"
}

# ============================================================
# SONG SCANNING
# ============================================================
scan_songs() {
    PLAYLIST=()
    if [[ ! -d "$SONGS_DIR" ]]; then
        echo -e "${RED}songs/ directory not found: $SONGS_DIR${RESET}"
        exit 1
    fi
    for dir in "$SONGS_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name
        name=$(basename "$dir")
        local audio
        audio=$(find "$dir" -maxdepth 1 -type f \
            \( -iname "*.wav" -o -iname "*.mp3" -o -iname "*.flac" \
               -o -iname "*.ogg" -o -iname "*.aiff" -o -iname "*.m4a" \) \
            2>/dev/null | head -1)
        [[ -n "$audio" ]] && PLAYLIST+=("$name")
    done
    if [[ ${#PLAYLIST[@]} -eq 0 ]]; then
        echo -e "${RED}No songs found.${RESET}"
        echo "Put each song in its own folder under songs/ with an audio file inside."
        exit 1
    fi
}

get_audio() { find "$SONGS_DIR/$1" -maxdepth 1 -type f \( -iname "*.wav" -o -iname "*.mp3" -o -iname "*.flac" -o -iname "*.ogg" -o -iname "*.aiff" -o -iname "*.m4a" \) 2>/dev/null | head -1; }
get_cover() { find "$SONGS_DIR/$1" -maxdepth 1 -type f \( -iname "cover.*" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) 2>/dev/null | head -1; }
get_lrc()   { find "$SONGS_DIR/$1" -maxdepth 1 -type f -iname "*.lrc" 2>/dev/null | head -1; }

# ============================================================
# ASCII ART
# ============================================================
load_ascii() {
    local cover="$1"
    local name="$2"
    local cache="$CACHE_DIR/${name}.txt"

    # Return cached version if available
    if [[ -f "$cache" ]]; then
        cat "$cache"
        return
    fi

    if [[ -n "$cover" && -f "$cover" ]]; then
        jp2a --colors --color-depth=24 --fill --chars='##' --width="$COLUMNS" "$cover" 2>/dev/null | tee "$cache" || true
    else
        # Decorative pattern when no cover image
        local out=""
        local chars=("♪" "♫" "♬" "⋆" "·" "✦" "✧" " " " " " ")
        local n=${#chars[@]}
        for ((i=0; i<LINES-10; i++)); do
            local line=""
            for ((j=0; j<COLUMNS; j++)); do
                local r=$(( RANDOM % n ))
                line+="${chars[$r]}"
            done
            printf '%s\n' "$line"
        done | tee "$cache"
    fi
}

# ============================================================
# LRC PARSER: output "seconds|text" lines
# ============================================================
parse_lrc() {
    local lrc="$1"
    [[ -z "$lrc" || ! -f "$lrc" ]] && return
    while IFS= read -r line; do
        if [[ "$line" =~ ^\[([0-9]+):([0-9.]+)\](.+)$ ]]; then
            local min="${BASH_REMATCH[1]}"
            local sec="${BASH_REMATCH[2]}"
            local text="${BASH_REMATCH[3]}"
            text=$(echo "$text" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            [[ -z "$text" ]] && continue
            # Skip production metadata lines
            if [[ "$text" =~ (作曲|作词|编曲|制作人|人声|电吉他|和声|录音棚|录音师|混音师|母带|出品) ]]; then
                continue
            fi
            # Skip title/credits line at 00:00
            local total=$(( 10#$min * 60 + ${sec%%.*} ))
            if [[ $total -eq 0 ]] && [[ "$text" =~ [-] ]] && [[ "$text" =~ (HOYO|Chevy|知更鸟) ]]; then
                continue
            fi
            echo "$total|$text"
        fi
    done < "$lrc"
}

# ============================================================
# NON-BLOCKING KEYBOARD INPUT
# ============================================================
read_key() {
    local key
    IFS= read -r -t 0.08 -n 1 key 2>/dev/null || { echo ""; return; }
    if [[ "$key" == $'\e' ]]; then
        local k2 k3
        IFS= read -r -t 0.01 -n 1 k2 2>/dev/null || { echo "ESC"; return; }
        if [[ "$k2" == '[' ]]; then
            IFS= read -r -t 0.01 -n 1 k3 2>/dev/null || { echo ""; return; }
            case "$k3" in
                C) echo "RIGHT" ;;
                D) echo "LEFT"  ;;
                *) echo "" ;;
            esac
        else
            echo "ESC"
        fi
    else
        echo "$key"
    fi
}

# ============================================================
# DRAW INFO PANEL - STATIC FRAME (called once at song start)
# ============================================================
draw_panel_frame() {
    local title="$1"
    local has_lyrics="$2"

    local pw=62
    local ph=9
    [[ "$has_lyrics" == "true" ]] && ph=11

    local pr=$(( (LINES - ph) / 2 ))
    local pc=$(( (COLUMNS - pw) / 2 ))
    [[ $pr -lt 5 ]] && pr=5
    [[ $pc -lt 0 ]] && pc=0

    # Remember panel position for incremental updates
    PANEL_ROW=$pr
    PANEL_COL=$pc
    PANEL_W=$pw
    PANEL_H=$ph

    # Draw background rows
    local row
    for ((row=0; row<ph; row++)); do
        tput cup $((pr + row)) $pc
        printf "${BG}%${pw}s${RESET}" ""
    done

    # Title
    tput cup "$pr" "$pc"
    printf "${BG}${BOLD}${CYAN}  ♪ %s${RESET}" "${title:0:50}"

    # Separator
    tput cup $((pr + 1)) "$pc"
    printf "${BG}${DIM}  ─────────────────────────────────────────────────────────${RESET}"

    # Bottom line
    local last=$((pr + ph - 1))
    tput cup "$last" "$pc"
    printf "${BG}${DIM}%${pw}s${RESET}" ""
}

# ============================================================
# DRAW INFO PANEL - DYNAMIC (called each frame, minimal updates)
# ============================================================
draw_panel_dynamic() {
    local current_lyric="$1" next_lyric="$2"
    local elapsed="$3" duration="$4" total="$5" idx="$6"
    local has_lyrics="$7"

    local pr="${PANEL_ROW:-5}"
    local pc="${PANEL_COL:-9}"
    local pw="${PANEL_W:-62}"

    # --- Progress bar ---
    local pct=0
    if [[ "$duration" -gt 0 ]]; then
        pct=$(( elapsed * 100 / duration ))
    fi
    [[ $pct -gt 100 ]] && pct=100
    local bar_w=44
    local fill=$(( pct * bar_w / 100 ))
    local bar=""
    local i
    for ((i=0; i<fill; i++)); do bar+="█"; done
    for ((i=fill; i<bar_w; i++)); do bar+="░"; done

    local ets
    ets=$(sec_to_ts "$elapsed")
    local ts_dur
    ts_dur=$(sec_to_ts "$duration")

    local mode_str="顺序"
    [[ "$MODE" == "loop" ]] && mode_str="循环"

    if [[ "$has_lyrics" == "true" ]]; then
        # Current lyric (only redraw if changed)
        if [[ "$current_lyric" != "$LAST_LYRIC" ]]; then
            local disp
            disp=$(trunc_visual "$current_lyric" 54)
            tput cup $((pr + 2)) "$pc"
            printf "${BG}${GREEN}${BOLD}  ♪ %-54s${RESET}" "$disp"
            LAST_LYRIC="$current_lyric"
        fi
        # Next lyric (only redraw if changed)
        if [[ "$next_lyric" != "$LAST_NEXT" ]]; then
            local disp2
            disp2=$(trunc_visual "$next_lyric" 54)
            tput cup $((pr + 3)) "$pc"
            printf "${BG}${DIM}    %-54s${RESET}" "$disp2"
            LAST_NEXT="$next_lyric"
        fi
        # Progress bar
        tput cup $((pr + 5)) "$pc"
        printf "${BG}  %s ${ets} / ${ts_dur}${RESET}" "$bar"
        # Bottom info
        tput cup $((pr + 7)) "$pc"
    else
        # Pure mode placeholder
        tput cup $((pr + 2)) "$pc"
        printf "${BG}${DIM}  ♪ 纯享模式${RESET}"
        # Progress bar
        tput cup $((pr + 4)) "$pc"
        printf "${BG}  %s ${ets} / ${ts_dur}${RESET}" "$bar"
        # Bottom info
        tput cup $((pr + 6)) "$pc"
    fi

    printf "${BG}  %s  |  %d/%d  |  Space:暂停  q:退出${RESET}" \
        "$mode_str" "$((idx + 1))" "$total"
}

# ============================================================
# PLAY ONE SONG
#   Returns 0 = finished naturally
#           1 = skip to next
#           2 = skip to prev
# ============================================================
play_song() {
    local name="$1"
    local idx="$2"
    local total="$3"

    local audio cover lrc duration
    audio=$(get_audio "$name")
    cover=$(get_cover "$name")
    lrc=$(get_lrc "$name")

    if [[ -z "$audio" ]]; then
        echo -e "${RED}No audio file in: $name${RESET}"
        return 1
    fi

    # Get duration in seconds
    duration=$(soxi -D "$audio" 2>/dev/null || echo "0")
    duration=${duration%.*}
    [[ -z "$duration" || "$duration" == "0" ]] && duration=240

    # Clear + draw ASCII background
    printf '\033[2J\033[H'
    tput civis
    load_ascii "$cover" "$name"

    # Parse lyrics
    local has_lyrics="false"
    local -a lrc_times=()
    local -a lrc_lines=()
    if [[ -n "$lrc" && -f "$lrc" ]]; then
        while IFS='|' read -r t txt; do
            [[ -z "$t" ]] && continue
            lrc_times+=("$t")
            lrc_lines+=("$txt")
        done < <(parse_lrc "$lrc")
        [[ ${#lrc_times[@]} -gt 0 ]] && has_lyrics="true"
    fi

    # Start audio playback in background
    if [[ "$ENGINE" == "ffplay" ]]; then
        ffplay -nodisp -autoexit -loglevel quiet "$audio" &>/dev/null &
        SOX_PID=$!
    else
        # rate -v -L = linear phase (highest quality), gain -n = normalize, dither -S = shaped noise
        sox "$audio" -d rate -v -L 44100 gain -n -1 dither -S 2>/dev/null &
        SOX_PID=$!
    fi
    local start_sec=${SECONDS}
    local paused=false
    local pause_accum=0
    local pause_start=0

    local current_lyric="" next_lyric=""
    local LAST_LYRIC="" LAST_NEXT=""
    local li=0  # lyric index

    # Draw static panel frame once
    draw_panel_frame "$name" "$has_lyrics"

    while true; do
        # Elapsed (accounting for pauses)
        local now=${SECONDS}
        local elapsed=$(( now - start_sec - pause_accum ))
        [[ $elapsed -lt 0 ]] && elapsed=0

        # Check if sox finished
        if ! kill -0 "$SOX_PID" 2>/dev/null; then
            break
        fi

        # Guard against infinite playback
        if [[ $elapsed -gt $((duration + 5)) ]]; then
            kill "$SOX_PID" 2>/dev/null || true
            break
        fi

        # Update lyrics
        if [[ "$has_lyrics" == "true" ]]; then
            current_lyric=""
            next_lyric=""
            local i
            for ((i=0; i<${#lrc_times[@]}; i++)); do
                if [[ ${lrc_times[$i]} -le $elapsed ]]; then
                    current_lyric="${lrc_lines[$i]}"
                    if (( i + 1 < ${#lrc_times[@]} )); then
                        next_lyric="${lrc_lines[$i+1]}"
                    fi
                fi
            done
        fi

        # Draw (incremental — only changed parts)
        draw_panel_dynamic "$current_lyric" "$next_lyric" \
            "$elapsed" "$duration" "$total" "$idx" "$has_lyrics"

        # Handle keyboard input
        local key
        key=$(read_key)
        case "$key" in
            q|Q)
                cleanup
                ;;
            "ESC")
                cleanup
                ;;
            " ")
                if "$paused"; then
                    kill -CONT "$SOX_PID" 2>/dev/null || true
                    pause_accum=$(( pause_accum + now - pause_start ))
                    paused=false
                else
                    kill -STOP "$SOX_PID" 2>/dev/null || true
                    pause_start=$now
                    paused=true
                fi
                ;;
        esac

        sleep 0.08
    done

    wait "$SOX_PID" 2>/dev/null || true
    SOX_PID=""
    return 0
}

# ============================================================
# SPLASH SCREEN
# ============================================================
splash() {
    printf '\033[2J\033[H'
    local center_row=$(( LINES / 2 - 3 ))
    tput cup "$center_row" 0

    cat <<EOF
$CYAN
               ╔═══════════════════════════════════════╗
               ║                                       ║
               ║     ♪  终 端 复 古 唱 片 机  ♪       ║
               ║     Terminal Record Player            ║
               ║                                       ║
               ║       核心工具: sox + jp2a            ║
               ║                                       ║
               ╚═══════════════════════════════════════╝
$RESET
EOF

    tput cup $((center_row + 8)) 0
    echo -e "${DIM}$(printf '%*s' "$COLUMNS" '' | tr ' ' '─')${RESET}"
    echo ""
    echo -e "  ${BOLD}Songs:${RESET}"
    local i=0
    for s in "${PLAYLIST[@]}"; do
        echo -e "    ${GREEN}$((i+1)).${RESET} $s"
        i=$((i+1))
    done
    echo ""
    echo -e "  ${BOLD}Mode:${RESET} $MODE"
    echo -e "  ${BOLD}Engine:${RESET} $ENGINE"
    echo -e "  ${YELLOW}Press Enter to start or Ctrl+C to quit${RESET}"

    read -r
}

# ============================================================
# USAGE
# ============================================================
usage() {
    cat <<EOF
${BOLD}Terminal Record Player${RESET} — 终端复古唱片机

${BOLD}Usage:${RESET} $0 [OPTIONS]

${BOLD}Options:${RESET}
  -m MODE      Play mode: sequential (default) | loop
  -s SONG      Play a specific song folder
  -e ENGINE    Audio backend: ffplay (default) | sox
  -l           List available songs
  -h           Show this help

${BOLD}Examples:${RESET}
  $0                    Play all songs sequentially
  $0 -m loop            Loop all songs
  $0 -s robin           Play only the 'robin' song
  $0 -s robin -m loop   Loop a specific song
  $0 -e ffplay          Use ffplay as audio backend

${BOLD}Controls during playback:${RESET}
  Space        Pause / Resume
  q / Esc      Quit
EOF
    exit 0
}

# ============================================================
# MAIN
# ============================================================
main() {
    check_deps

    while getopts "m:s:e:lhn" opt; do
        case $opt in
            m) MODE="$OPTARG"
               if [[ "$MODE" != "sequential" && "$MODE" != "loop" ]]; then
                   echo -e "${RED}Invalid mode: $MODE${RESET} (use 'sequential' or 'loop')"
                   exit 1
               fi
               ;;
            s) TARGET="$OPTARG" ;;
            e) ENGINE="$OPTARG"
               if [[ "$ENGINE" != "sox" && "$ENGINE" != "ffplay" ]]; then
                   echo -e "${RED}Invalid engine: $ENGINE${RESET} (use 'sox' or 'ffplay')"
                   exit 1
               fi
               ;;
            l) scan_songs
               echo -e "${BOLD}Available songs:${RESET}"
               for s in "${PLAYLIST[@]}"; do echo "  ${GREEN}•${RESET} $s"; done
               exit 0
               ;;
            h) usage ;;
            *) usage ;;
        esac
    done

    scan_songs

    if [[ -n "$TARGET" ]]; then
        local found=false
        for s in "${PLAYLIST[@]}"; do
            [[ "$s" == "$TARGET" ]] && found=true
        done
        if ! $found; then
            echo -e "${RED}Song not found: '$TARGET'${RESET}"
            echo "Available: ${PLAYLIST[*]}"
            exit 1
        fi
        PLAYLIST=("$TARGET")
    fi

    splash

    while true; do
        local name="${PLAYLIST[$CURRENT]}"
        [[ -z "$name" ]] && break

        play_song "$name" "$CURRENT" "${#PLAYLIST[@]}"

        # Advance to next song
        if [[ "$MODE" == "loop" ]]; then
            CURRENT=$(( (CURRENT + 1) % ${#PLAYLIST[@]} ))
        else
            CURRENT=$(( CURRENT + 1 ))
            if [[ $CURRENT -ge ${#PLAYLIST[@]} ]]; then
                break
            fi
        fi

        sleep 0.3
    done

    cleanup
}

main "$@"
