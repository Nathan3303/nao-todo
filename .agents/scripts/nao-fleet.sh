#!/usr/bin/env bash
# =============================================================================
# nao-fleet.sh — 按角色一键拉起 pi 会话窗口（nao 团队工具箱）
#
# 用法
#   nao-fleet.sh check [--strict]                 静态体检：roles.yaml/角色卡/交叉引用/白名单/布局
#   nao-fleet.sh status                           角色会话在线状态（权威名单见 intercom list）
#   nao-fleet.sh ensure <别名>[@<repo>] [更多...]  拉起角色窗口（默认工作区=roles.yaml workspace）
#   nao-fleet.sh ensure -m <model> <别名>...       显式指定模型（须命中白名单）
#   nao-fleet.sh ensure --force <别名>...          忽略"已在运行"判重
#
# 角色别名 → 角色卡：见 .agents/roles.yaml（单一事实来源）
#   当前：pm / arch-designer(arch) / rd-fe / rd-be / qa
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

MANIFEST="$SKILLS_DIR/.agents/roles.yaml"
CARD_MAX_LINES=200
ROLE_ORDER=()
declare -A ROLE_CARDS ROLE_WS ALIAS_ROLE
MODEL_WHITELIST="${NAO_MODEL_WHITELIST:-}"
TMUX_LAYOUT="${NAO_TMUX_LAYOUT:-main-row2}"
TMUX_MAIN_WIDTH="${NAO_TMUX_MAIN_WIDTH:-50}"

log()  { printf '\033[1;32m[fleet]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[fleet]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[fleet]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# roles.yaml 解析（顶层 roles:；角色层级取 roles: 后首个非注释非空行缩进，
# 更深缩进视为字段 ⇒ 2/4 与 4/8 均可；行尾 \r 容忍（CRLF）；禁 Tab）
# 填充 ROLE_ORDER / ROLE_CARDS / ROLE_WS / ALIAS_ROLE；解析失败即 die
load_manifest() {
  local f="$MANIFEST" out
  [[ -f "$f" ]] || die "角色清单缺失: $f（请创建 .agents/roles.yaml）"
  out="$(awk -F'\t' '
    function die(msg) { print "ERR: " FNR ": " msg; bad=1 }
    BEGIN { bad=0; in_roles=0; role_ind=-1; cur=""; n=0 }
    {
      sub(/\r$/, "")            # CRLF 容忍：剥离行尾 \r
      if ($0 ~ /^[[:space:]]*#/) next
      if ($0 ~ /^[[:space:]]*$/) next
      if ($0 ~ /\t/) { die("禁止 Tab 缩进"); next }
      if (!in_roles) {
        if ($0 ~ /^[[:space:]]*roles:[[:space:]]*$/) { in_roles=1; next }
        die("顶层仅允许 roles:，得到: " $0); next
      }
      match($0, /^ */); ind=RLENGTH   # 当前行缩进宽度（仅空格）
      line=$0; sub(/^[ ]+/, "", line); sub(/[ ]+$/, "", line)
      if (role_ind < 0) {
        # roles: 之后首个非注释非空行 = 角色条目，其缩进即角色层级
        if (line !~ /^[a-z0-9][a-z0-9-]*:[[:space:]]*$/) { die("roles: 后首行须为角色条目: " $0); next }
        role_ind=ind
      }
      if (ind == role_ind) {
        if (line !~ /^[a-z0-9][a-z0-9-]*:[[:space:]]*$/) { die("非法角色 id: " line); next }
        cur=line; sub(/:.*/, "", cur)
        card[cur]=""; ws[cur]="."; na[cur]=0; order[++n]=cur; next
      }
      if (ind > role_ind) {
        if (line !~ /^[a-z_]+:[[:space:]]/) { die("无法解析: " $0); next }
        key=line; sub(/:.*/, "", key)
        val=line; sub(/^[a-z_]+:[[:space:]]*/, "", val)
        if      (key=="card")      { card[cur]=val }
        else if (key=="workspace") { ws[cur]=val }
        else if (key=="aliases") {
          if (val !~ /^\[[^]]*\]$/) { die(cur ".aliases 须为 [a, b] 列表: " $0); next }
          gsub(/^\[|\]$/, "", val); m=split(val, arr, /,/)
          for (i=1; i<=m; i++) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", arr[i]); if (arr[i]!="") alias[cur,++na[cur]]=arr[i] }
          if (na[cur]==0) die(cur ".aliases 为空")
        }
        else die(cur " 未知字段: " key)
        next
      }
      die("无法解析: " $0)
    }
    END {
      if (bad) exit 1
      if (!in_roles) { print "ERR: 缺少 roles: 顶层键"; exit 1 }
      for (i=1; i<=n; i++) { c=order[i]; if (card[c]=="") { print "ERR: " c " 缺少 card"; bad=1 } if (na[c]==0) { print "ERR: " c " 缺少 aliases"; bad=1 } }
      if (bad) exit 1
      for (i=1; i<=n; i++) { c=order[i]; print "ROLE\t" c "\t" card[c] "\t" ws[c]; for (j=1; j<=na[c]; j++) print "ALIAS\t" c "\t" alias[c,j] }
    }
  ' "$f")" || { printf '%s\n' "$out" >&2; die "roles.yaml 解析失败: $f"; }
  local k v w rest
  while IFS=$'\t' read -r k v w rest; do
    case "$k" in
      ROLE)  ROLE_ORDER+=("$v"); ROLE_CARDS["$v"]="$w"; ROLE_WS["$v"]="$rest" ;;
      ALIAS) ALIAS_ROLE["$v"]="$w" ;;
    esac
  done <<< "$out"
}

# 读取卡片 frontmatter 字段（--- 与 --- 之间）
card_field() {
  awk -v k="$2" '
    { sub(/\r$/, "") }        # CRLF 容忍：frontmatter 定界符 /^---$/ 方可命中
    /^---$/ { c++; next }
    c == 1 && $0 ~ "^" k ":" { sub("^" k ": *", ""); print; exit }
  ' "$1"
}

# 校验卡片/公共规范/清单中的 @.agents/... 引用均存在（含 checklists/ 子目录；跨仓库会话能解析的关键保障）
check_cross_refs() {
  local rc=0 src ref
  local -a srcs=()
  shopt -s nullglob
  srcs+=("$PROMPTS_DIR"/*.md "$COMMON_DIR"/*.md "$SKILLS_SUB"/*.md "$SKILLS_DIR"/.agents/checklists/*.md)
  shopt -u nullglob
  for src in "${srcs[@]}"; do
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      case "$ref" in
        common/*|skills/*|prompts/*|scripts/*|templates/*|checklists/*) ;;
        *) continue ;;
      esac
      if [[ ! -e "$SKILLS_DIR/.agents/$ref" ]]; then
        printf '  ✗ %s → @.agents/%s 缺失\n' "$(basename "$src")" "$ref"
        rc=1
      fi
    done < <(grep -hoE '@\.agents/(common|skills|prompts|scripts|templates|checklists)/[A-Za-z0-9._/-]+' "$src" | sed 's/^@\.agents\///' | sort -u)
  done
  [[ $rc -eq 0 ]] && echo '  ✓ 全部引用文件存在'
  return $rc
}

# CodeGraph 索引健康（ensure 拉起前 / check 用；缺失或过期仅 warn，不阻塞）
check_codegraph() {
  local repo="$1" name st
  name="$(basename "$repo")"
  command -v codegraph >/dev/null 2>&1 || { warn "$name codegraph 未安装（RD 定位将回退 grep，属预期）"; return 0; }
  if [[ ! -d "$repo/.codegraph" ]]; then
    warn "$name 无 CodeGraph 索引（RD 定位将回退 grep；建议 codegraph init）"
    return 0
  fi
  st="$(cd "$repo" 2>/dev/null && codegraph status 2>&1)"
  if [[ "$st" == *"Index is up to date"* ]]; then
    log "$name CodeGraph 索引 ✓ up to date"
  elif [[ "$st" == *"Pending Changes"* ]]; then
    warn "$name CodeGraph 索引有未同步变更（建议 codegraph sync）"
  elif [[ "$st" == *"Not initialized"* ]]; then
    warn "$name .codegraph 存在但未初始化（建议 codegraph init）"
  else
    warn "$name codegraph status 输出不可解析"
  fi
}

# ---------------------------------------------------------------------------
resolve_role() {
  local id="${ALIAS_ROLE[$1]:-}"
  [[ -n "$id" ]] || die "未知角色: $1（可用: ${ROLE_ORDER[*]}）"
  NAME="$id"
  PROMPT="${ROLE_CARDS[$id]}"
}

detect_host() {
  if [[ -n "${NAO_TERMINAL:-}" ]]; then echo "$NAO_TERMINAL"; return; fi
  if [[ -n "${TMUX:-}" ]] && command -v tmux >/dev/null 2>&1; then echo tmux; return; fi
  for h in ghostty ptyxis tmux; do
    command -v "$h" >/dev/null 2>&1 && { echo "$h"; return; }
  done
  echo screen
}

running() { pgrep -f -- "pi[[:space:]].*--name $1([[:space:]]|$)" >/dev/null 2>&1; }

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

# 组装系统提示文件：角色卡 + 环境锚点（本机绝对路径，供跨仓库会话解析 @ 引用失败时兜底）
build_system_prompt() {
  local card="$1" f
  f="$(mktemp "/tmp/nao-fleet-$(basename "$card" .md)-XXXXXX.md")"
  {
    cat "$card"
    printf '\n## 环境锚点\n- NAO_SKILLS=%s（@.agents/... 引用以会话 cwd 解析；cwd 无 .agents 时以 NAO_SKILLS 为根拼接绝对路径）\n' "$SKILLS_DIR"
  } > "$f"
  echo "$f"
}

spawn_one() {
  local name="$1" repo="$2" model="$3" card prompt_file host inner
  card="$PROMPTS_DIR/$PROMPT"
  [[ -f "$card" ]] || die "角色卡不存在: $card"
  [[ -d "$repo" ]] || die "工作区不存在: $repo"

  prompt_file="$(build_system_prompt "$card")"
  inner="cd $(printf %q "$repo") && exec pi --name $(printf %q "$name")"
  [[ -n "$model" ]] && inner+=" --model $(printf %q "$model")"
  inner+=" --append-system-prompt $(printf %q "$prompt_file")"
  ( sleep 60; rm -f -- "$prompt_file" ) & disown 2>/dev/null || true

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
  local rc=0 f lines d
  local wl_problems=0

  echo "== 目录 =="
  for d in "$PROMPTS_DIR" "$COMMON_DIR" "$SKILLS_SUB"; do
    if [[ -d "$d" ]]; then printf '  ✓ %s\n' "$d"
    else printf '  ✗ 缺失: %s\n' "$d"; rc=1; fi
  done

  echo "== 角色清单 roles.yaml =="
  printf '  ✓ 解析成功，%d 个角色: %s\n' "${#ROLE_ORDER[@]}" "${ROLE_ORDER[*]}"

  echo "== 常驻角色卡（阈值 ${CARD_MAX_LINES} 行，frontmatter 校验）=="
  local a role version updated
  for a in "${ROLE_ORDER[@]}"; do
    f="$PROMPTS_DIR/${ROLE_CARDS[$a]}"
    if [[ ! -f "$f" ]]; then
      printf '  ✗ %-26s 缺失\n' "${ROLE_CARDS[$a]}"; rc=1; continue
    fi
    lines=$(wc -l < "$f")
    if (( lines > CARD_MAX_LINES )); then
      printf '  ! %-26s %3d 行（超阈值，建议拆到 skills/）\n' "${ROLE_CARDS[$a]}" "$lines"
    else
      printf '  ✓ %-26s %3d 行\n' "${ROLE_CARDS[$a]}" "$lines"
    fi
    role="$(card_field "$f" role)"
    version="$(card_field "$f" version)"
    updated="$(card_field "$f" updated)"
    if [[ "$role" != "$a" ]]; then
      printf '  ✗ %s frontmatter role=%s 与 manifest 角色 %s 不一致\n' "${ROLE_CARDS[$a]}" "${role:-<缺失>}" "$a"; rc=1
    fi
    if [[ ! "$version" =~ ^[0-9]+$ ]]; then
      printf '  ✗ %s frontmatter version=%s 缺失或非整数\n' "${ROLE_CARDS[$a]}" "${version:-<缺失>}"; rc=1
    fi
    if [[ -z "$updated" ]]; then
      printf '  ✗ %s frontmatter updated 缺失（应如 2026-09-21）\n' "${ROLE_CARDS[$a]}"; rc=1
    fi
  done

  echo "== prompts/ 孤儿检查 =="
  local cf found c2 orphan=0
  shopt -s nullglob
  for cf in "$PROMPTS_DIR"/*.md; do
    found=0
    for c2 in "${ROLE_ORDER[@]}"; do
      [[ "$(basename "$cf")" == "${ROLE_CARDS[$c2]}" ]] && found=1
    done
    if (( ! found )); then printf '  ! %s 未登记于 roles.yaml\n' "$(basename "$cf")"; orphan=1; fi
  done
  shopt -u nullglob
  (( orphan )) || echo '  ✓ 无孤儿卡'

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

  echo "== 交叉引用（@.agents/common|skills|prompts|scripts/... 均须存在）=="
  check_cross_refs || rc=1

  echo "== CodeGraph 索引（业务 repo 的索引在 ensure 拉起时检查）=="
  if command -v codegraph >/dev/null 2>&1; then
    if [[ -d "$PWD/.codegraph" ]]; then
      local cgst
      cgst="$(codegraph status 2>&1)"
      if [[ "$cgst" == *"up to date"* ]]; then
        echo '  ✓ 当前目录索引 up to date'
      elif [[ "$cgst" == *"Pending Changes"* ]]; then
        # 索引过期仅为提醒（与 check_codegraph 口径一致），不计入退出码，避免误停派发
        echo '  ! 当前目录索引有未同步变更（codegraph sync）'
      else
        echo '  · 当前目录有索引，状态见 codegraph status'
      fi
    else
      echo '  · 当前目录无索引（业务 repo 的索引在 ensure 拉起时检查）'
    fi
  else
    echo '  · codegraph 未安装（回退 grep 属预期行为）'
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
cmd_status() {
  local a
  echo "== 角色会话在线状态（权威名单以 intercom({action:'list'}) 为准）=="
  for a in "${ROLE_ORDER[@]}"; do
    if running "$a"; then
      printf '  ✓ %-14s 在线（--name %s；卡片 %s）\n' "$a" "$a" "${ROLE_CARDS[$a]}"
    else
      printf '  · %-14s 未运行（ensure 拉起）\n' "$a"
    fi
  done
}

# ---------------------------------------------------------------------------
cmd_ensure() {
  local force="$1" model="$2"; shift 2
  local spec role repo key seen k
  local -a cg_done=()
  [[ $# -eq 0 ]] && die "ensure 需要至少一个角色，如: nao-fleet.sh ensure arch rd-fe"
  for spec in "$@"; do
    if [[ "$spec" == *"@"* ]]; then
      role="${spec%%@*}"; repo="${spec#*@}"
    else
      role="$spec"; repo=""
    fi
    resolve_role "$role"
    [[ -n "$repo" ]] || repo="${ROLE_WS[$NAME]:-$PWD}"
    # CodeGraph 索引健康（同 repo 只查一次，不阻塞拉起）
    key="$repo"; seen=0
    for k in "${cg_done[@]:-}"; do [[ "$k" == "$key" ]] && seen=1; done
    if (( ! seen )); then check_codegraph "$repo"; cg_done+=("$key"); fi
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
    { sub(/\r$/, "") }        # CRLF 容忍（脚本自身为 CRLF 时仍可打印用法）
    /^# =+$/ { c++; if (c==2) exit; next }
    c==1 && /^#/ { sub(/^# ?/,""); print }
  ' "$0"
  exit 0
}

# ---- 入口 ----
CMD=""; FORCE=false; STRICT=false; MODEL=""; TARGETS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    check)  CMD="check";  shift ;;
    status) CMD="status"; shift ;;
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
  check|ensure|status) load_manifest ;;
esac

case "$CMD" in
  check)  cmd_check "$STRICT" ;;
  status) cmd_status ;;
  ensure) cmd_ensure "$FORCE" "$MODEL" "${TARGETS[@]}" ;;
  *) usage ;;
esac