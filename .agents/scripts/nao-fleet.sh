#!/usr/bin/env bash
# =============================================================================
# nao-fleet.sh — 按角色一键拉起 pi 会话窗口（nao 团队工具箱）
#
# 用法
#   nao-fleet.sh check [--strict]                 静态体检：目录/角色卡/白名单/布局
#   nao-fleet.sh ensure <别名>[@<repo>] [更多...]  拉起角色窗口（默认工作区=$PWD）
#   nao-fleet.sh ensure -m <model> <别名>...       显式指定模型（须命中白名单）
#   nao-fleet.sh ensure --force <别名>...          忽略"已在运行"判重
#
# 角色别名 → 角色卡
#   pm       → product-manager.md
#   arch     → architecture-designer.md  (arch-designer 同义)
#   rd-fe    → frontend-developer.md
#   rd-be    → backend-developer.md
#   qa       → test-engineer.md
#
# 环境变量
#   NAO_TERMINAL=ghostty|ptyxis|tmux|screen   强制宿主
#   NAO_TMUX_LAYOUT=main-row2|grid            tmux 布局（默认 main-row2）
#   NAO_TMUX_MAIN_WIDTH=<10..90>              main-row2 主 pane 宽度百分比（默认 50）
#   NAO_SKILLS=<dir>                          角色卡根目录（默认 <脚本>/../..）
#   NAO_MODEL_WHITELIST=<glob,...>            -m 白名单（默认空=不校验，支持 glob）
#
# tmux 宿主行为
#   - 已在 tmux 内（$TMUX 存在）：当前窗口分屏拉起，不新建窗口。
#   - 不在 tmux 内：创建 detached 会话 nao-<角色>，需 tmux attach -t nao-<角色>。
#   - main-row2：第 1 个 pane 全高占左，后续每角色往右开列、每列上下 2 个：
#                 1 | 2 | 4
#                 1 | 3 | 5
#   - grid：所有 pane 等大网格（tmux 内建 tiled）。
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="${NAO_SKILLS:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PROMPTS_DIR="$SKILLS_DIR/.agents/prompts"
COMMON_DIR="$SKILLS_DIR/.agents/common"
SKILLS_SUB="$SKILLS_DIR/.agents/skills"

ALL_ROLES=(pm arch-designer rd-fe rd-be qa)
CARD_MAX_LINES=200
MODEL_WHITELIST="${NAO_MODEL_WHITELIST:-}"
TMUX_LAYOUT="${NAO_TMUX_LAYOUT:-main-row2}"
TMUX_MAIN_WIDTH="${NAO_TMUX_MAIN_WIDTH:-33}"

log()  { printf '\033[1;32m[fleet]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[fleet]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[fleet]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
resolve_role() {
  case "$1" in
    pm)                  NAME="pm";            PROMPT="product-manager.md" ;;
    arch|arch-designer)  NAME="arch-designer"; PROMPT="architecture-designer.md" ;;
    rd-fe)               NAME="rd-fe";         PROMPT="frontend-developer.md" ;;
    rd-be)               NAME="rd-be";         PROMPT="backend-developer.md" ;;
    qa)                  NAME="qa";            PROMPT="test-engineer.md" ;;
    *) die "未知角色: $1（可用: ${ALL_ROLES[*]}）" ;;
  esac
}

detect_host() {
  if [[ -n "${NAO_TERMINAL:-}" ]]; then echo "$NAO_TERMINAL"; return; fi
  if [[ -n "${TMUX:-}" ]] && command -v tmux >/dev/null 2>&1; then echo tmux; return; fi
  for h in ghostty ptyxis tmux; do
    command -v "$h" >/dev/null 2>&1 && { echo "$h"; return; }
  done
  echo screen
}

running() { pgrep -f -- "--name $1" >/dev/null 2>&1; }

# 白名单命中返回 0，否则返回 1；未设白名单=放行
check_model() {
  local m="$1" entry
  local entries=()
  [[ -z "$MODEL_WHITELIST" ]] && return 0
  IFS=',' read -ra entries <<< "$MODEL_WHITELIST"
  for entry in "${entries[@]}"; do
    entry="${entry#"${entry%%[![:space:]]*}"}"
    entry="${entry%"${entry##*[![:space:]]}"}"
    [[ -z "$entry" ]] && continue
    # shellcheck disable=SC2053
    [[ "$m" == $entry ]] && return 0
  done
  return 1
}

# 16 位 checksum，与 tmux 源码 layout_checksum() 一致
_layout_checksum() {
  local s="$1" c=0 b
  local -a bytes=()
  # shellcheck disable=SC2207
  bytes=($(printf '%s' "$s" | od -An -v -tu1 | tr -s ' \n' ' '))
  for b in "${bytes[@]}"; do
    c=$(( ((c >> 1) + ((c & 1) << 15) + b) & 0xFFFF ))
  done
  printf '%04x' "$c"
}

# main-row2：主 pane 全高占左；往右每列 2 个上下堆叠
#   1 | 2 | 4
#   1 | 3 | 5
# tmux 规范：相邻子 pane 之间 1 格 gap；{} 左右排列，[] 上下排列
build_main_row2_layout() {
  local win_w="$1" win_h="$2" pct="$3"
  shift 3
  local -a panes=("$@")
  local n=${#panes[@]}
  (( n >= 1 )) || return 1
  if (( n == 1 )); then
    printf '%sx%s,0,0,%s' "$win_w" "$win_h" "${panes[0]}"
    return 0
  fi

  # 根：水平分割，主 pane + 右侧容器，中间 1 gap
  local usable_w=$(( win_w - 1 ))
  (( usable_w < 2 )) && usable_w=2
  local main_w=$(( usable_w * pct / 100 ))
  (( main_w < 1 )) && main_w=1
  (( main_w > usable_w - 1 )) && main_w=$(( usable_w - 1 ))
  local right_w=$(( usable_w - main_w ))
  (( right_w < 1 )) && right_w=1
  local right_x=$(( main_w + 1 ))

  # 右侧 cols 列
  local m=$(( n - 1 ))
  local cols=$(( (m + 1) / 2 ))
  (( cols < 1 )) && cols=1
  local r_usable=$(( right_w - (cols - 1) ))
  (( r_usable < 1 )) && r_usable=1
  local cw_base=$(( r_usable / cols ))
  (( cw_base < 1 )) && cw_base=1
  local cw_last=$(( r_usable - cw_base * (cols - 1) ))
  (( cw_last < 1 )) && cw_last=1

  # 每列内部：上下 2 个，中间 1 gap
  local v_usable=$(( win_h - 1 ))
  (( v_usable < 2 )) && v_usable=2
  local top_h=$(( v_usable / 2 ))
  (( top_h < 1 )) && top_h=1
  local bot_h=$(( v_usable - top_h ))
  (( bot_h < 1 )) && bot_h=1
  local bot_y=$(( top_h + 1 ))

  local -a col_parts=()
  local col col_x cw i_top i_bot
  for (( col=0; col<cols; col++ )); do
    col_x=$(( right_x + col * (cw_base + 1) ))
    if (( col == cols - 1 )); then cw=$cw_last; else cw=$cw_base; fi
    i_top=$(( col * 2 + 1 ))
    i_bot=$(( col * 2 + 2 ))
    if (( i_bot < n )); then
      col_parts+=("${cw}x${win_h},${col_x},0[${cw}x${top_h},${col_x},0,${panes[$i_top]},${cw}x${bot_h},${col_x},${bot_y},${panes[$i_bot]}]")
    elif (( i_top < n )); then
      col_parts+=("${cw}x${win_h},${col_x},0,${panes[$i_top]}")
    fi
  done

  local right_body
  if (( cols == 1 )); then
    right_body="${col_parts[0]}"
  else
    local IFS=','
    right_body="${right_w}x${win_h},${right_x},0{${col_parts[*]}}"
    unset IFS
  fi

  printf '%sx%s,0,0{%sx%s,0,0,%s,%s}' \
    "$win_w" "$win_h" \
    "$main_w" "$win_h" "${panes[0]}" \
    "$right_body"
}

apply_tmux_layout() {
  [[ -n "${TMUX:-}" ]] || return 0
  if [[ "$TMUX_LAYOUT" == "grid" ]]; then
    tmux select-layout tiled >/dev/null 2>&1 || true
    return
  fi
  # main-row2
  local win_w win_h
  read -r win_w win_h < <(tmux display-message -p '#{window_width} #{window_height}' 2>/dev/null)
  [[ -n "$win_w" && -n "$win_h" ]] || return 0

  local -a pane_ids=()
  local line
  while IFS= read -r line; do
    [[ -n "$line" ]] && pane_ids+=("$line")
  done < <(tmux list-panes -F '#{pane_id}' 2>/dev/null | sed 's/^%//')
  (( ${#pane_ids[@]} >= 1 )) || return 0

  local pct="$TMUX_MAIN_WIDTH"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=50
  (( pct < 10 )) && pct=10
  (( pct > 90 )) && pct=90

  local full; full="$(build_main_row2_layout "$win_w" "$win_h" "$pct" "${pane_ids[@]}")"
  [[ -n "$full" ]] || return 0

  local ck; ck="$(_layout_checksum "$full")"
  local err
  if ! err=$(tmux select-layout "${ck},${full}" 2>&1); then
    warn "main-row2 布局应用失败，回退 tiled"
    warn "  tmux:   ${err:-<no message>}"
    warn "  layout: $full"
    tmux select-layout tiled >/dev/null 2>&1 || true
  fi
}

spawn_tmux() {
  local name="$1" inner="$2"
  case "$TMUX_LAYOUT" in
    main-row2|grid) ;;
    *) die "NAO_TMUX_LAYOUT 无效: $TMUX_LAYOUT（可选 main-row2|grid）" ;;
  esac
  local wrapped="bash -lc $(printf %q "$inner")"
  if [[ -n "${TMUX:-}" ]]; then
    tmux split-window -h "$wrapped" >/dev/null
    apply_tmux_layout
  else
    tmux new-session -d -s "nao-$name" "$wrapped"
    log "tmux 会话 nao-$name 已创建（附加: tmux attach -t nao-$name）"
  fi
}

spawn_one() {
  local name="$1" repo="$2" model="$3" prompt_file host inner
  prompt_file="$PROMPTS_DIR/$PROMPT"
  [[ -f "$prompt_file" ]] || die "角色卡不存在: $prompt_file"
  [[ -d "$repo" ]]        || die "工作区不存在: $repo"

  inner="cd $(printf %q "$repo") && exec pi --name $(printf %q "$name")"
  [[ -n "$model" ]] && inner+=" --model $(printf %q "$model")"
  inner+=" --append-system-prompt $(printf %q "$prompt_file")"

  host="$(detect_host)"
  case "$host" in
    ghostty) setsid -f ghostty -e bash -lc "$inner" >/dev/null 2>&1 ;;
    ptyxis)  setsid -f ptyxis  -- bash -lc "$inner" >/dev/null 2>&1 ;;
    tmux)    spawn_tmux "$name" "$inner" ;;
    screen)  screen -dmS "nao-$name" bash -lc "$inner" ;;
    *) die "不支持的宿主: $host" ;;
  esac
  log "[$host] 已拉起 $name @ $repo${model:+（model=$model）}$([[ "$host" == tmux ]] && echo "（layout=$TMUX_LAYOUT）")"
}

# ---------------------------------------------------------------------------
cmd_check() {
  local strict="${1:-false}"
  local rc=0 a f lines d
  local wl_problems=0

  echo "== 目录 =="
  for d in "$PROMPTS_DIR" "$COMMON_DIR" "$SKILLS_SUB"; do
    if [[ -d "$d" ]]; then printf '  ✓ %s\n' "$d"
    else printf '  ✗ 缺失: %s\n' "$d"; rc=1; fi
  done

  echo "== 常驻角色卡（阈值 ${CARD_MAX_LINES} 行）=="
  for a in "${ALL_ROLES[@]}"; do
    resolve_role "$a"
    f="$PROMPTS_DIR/$PROMPT"
    if [[ ! -f "$f" ]]; then
      printf '  ✗ %-26s 缺失\n' "$PROMPT"; rc=1; continue
    fi
    lines=$(wc -l < "$f")
    if (( lines > CARD_MAX_LINES )); then
      printf '  ! %-26s %3d 行（超阈值，建议拆到 skills/）\n' "$PROMPT" "$lines"
    else
      printf '  ✓ %-26s %3d 行\n' "$PROMPT" "$lines"
    fi
  done

  echo "== 公共规范 =="
  for f in output-format.md intercom-protocol.md; do
    if [[ -f "$COMMON_DIR/$f" ]]; then printf '  ✓ %s\n' "$f"
    else printf '  ✗ %s 缺失\n' "$f"; rc=1; fi
  done

  echo "== 按需技能 =="
  if [[ -d "$SKILLS_SUB" ]]; then
    shopt -s nullglob
    for f in "$SKILLS_SUB"/*.md; do printf '  · %s\n' "$(basename "$f")"; done
    shopt -u nullglob
  fi

  echo "== 模型白名单 =="
  if [[ -z "$MODEL_WHITELIST" ]]; then
    echo "  （未设置 NAO_MODEL_WHITELIST，-m 不校验）"
  else
    local entry s dup kind tag
    local entries=() seen=()
    IFS=',' read -ra entries <<< "$MODEL_WHITELIST"
    for entry in "${entries[@]}"; do
      entry="${entry#"${entry%%[![:space:]]*}"}"
      entry="${entry%"${entry##*[![:space:]]}"}"
      if [[ -z "$entry" ]]; then
        printf '  ! 空条目被忽略\n'
        wl_problems=$((wl_problems + 1))
        continue
      fi
      dup=0
      for s in "${seen[@]}"; do [[ "$s" == "$entry" ]] && { dup=1; break; }; done
      seen+=("$entry")
      case "$entry" in
        *'*'*|*'?'*|*'['*) kind="glob" ;;
        *)                 kind="字面量" ;;
      esac
      tag=""
      if (( dup )); then tag=" [重复]"; wl_problems=$((wl_problems + 1)); fi
      if [[ "$entry" == "*" ]]; then tag+=" [过宽!]"; wl_problems=$((wl_problems + 1)); fi
      printf '  · %-32s (%s)%s\n' "$entry" "$kind" "$tag"
    done
  fi

  echo "== tmux 布局 =="
  if [[ -n "${TMUX:-}" ]]; then
    echo "  当前在 tmux 内（会话 $(tmux display-message -p '#S' 2>/dev/null || echo '?')）"
  else
    echo "  （当前不在 tmux 内；若宿主命中 tmux 会创建 detached 会话）"
  fi
  case "$TMUX_LAYOUT" in
    main-row2|grid)
      printf '  ✓ NAO_TMUX_LAYOUT=%-10s 合法\n' "$TMUX_LAYOUT" ;;
    *)
      printf '  ✗ NAO_TMUX_LAYOUT=%-10s 非法（可选 main-row2|grid）\n' "$TMUX_LAYOUT"; rc=1 ;;
  esac
  if [[ "$TMUX_LAYOUT" == "main-row2" ]]; then
    if [[ "$TMUX_MAIN_WIDTH" =~ ^[0-9]+$ ]] && (( TMUX_MAIN_WIDTH >= 10 && TMUX_MAIN_WIDTH <= 90 )); then
      printf '  ✓ NAO_TMUX_MAIN_WIDTH=%-3s%% 合法\n' "$TMUX_MAIN_WIDTH"
    else
      printf '  ! NAO_TMUX_MAIN_WIDTH=%-3s  非法（10..90），运行时会回退 50\n' "$TMUX_MAIN_WIDTH"
    fi
  fi

  if [[ "$strict" == "true" && $wl_problems -gt 0 ]]; then
    warn "strict 模式：白名单发现 $wl_problems 项问题（空条目/重复/过宽）"
    rc=1
  fi

  exit $rc
}

# ---------------------------------------------------------------------------
cmd_ensure() {
  local force="$1" model="$2"; shift 2
  local spec role repo
  [[ $# -eq 0 ]] && die "ensure 需要至少一个角色，如: nao-fleet.sh ensure arch rd-fe"
  for spec in "$@"; do
    if [[ "$spec" == *"@"* ]]; then
      role="${spec%%@*}"; repo="${spec#*@}"
    else
      role="$spec"; repo="$PWD"
    fi
    resolve_role "$role"
    if [[ "$force" != "true" ]] && running "$NAME"; then
      warn "$NAME 已在运行（--name 识别），跳过；确需重开请加 --force"
      continue
    fi
    spawn_one "$NAME" "$repo" "$model"
  done
}

# ---------------------------------------------------------------------------
usage() {
  awk '
    /^# =+$/ { c++; if (c==2) exit; next }
    c==1 && /^#/ { sub(/^# ?/,""); print }
  ' "$0"
  exit 0
}

# ---- 入口 ----
CMD=""; FORCE=false; STRICT=false; MODEL=""; TARGETS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    check) CMD="check"; shift ;;
    ensure) CMD="ensure"; shift ;;
    -m|--model)
      MODEL="${2:-}"
      [[ -n "$MODEL" ]] || die "-m 需要模型参数"
      check_model "$MODEL" || die "模型 '$MODEL' 不在白名单内。允许: $MODEL_WHITELIST（可通过 NAO_MODEL_WHITELIST 覆盖）"
      shift 2 ;;
    --force)  FORCE=true;  shift ;;
    --strict) STRICT=true; shift ;;
    -h|--help) usage ;;
    *) TARGETS+=("$1"); shift ;;
  esac
done

case "$CMD" in
  check)  cmd_check "$STRICT" ;;
  ensure) cmd_ensure "$FORCE" "$MODEL" "${TARGETS[@]}" ;;
  *) usage ;;
esac