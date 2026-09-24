#!/usr/bin/env bash
# =============================================================================
# nao-fleet.sh — 按角色一键拉起 pi 会话窗口（nao 团队工具箱）
#
# 用法
#   nao-fleet.sh check [--strict] [-v]            静态体检：roles.yaml/缩进/EOL/角色卡/交叉引用/PR 模板/白名单/布局
#                                                 默认单行摘要（含 warn 计数）；-v 展开完整报告；失败始终展开
#   nao-fleet.sh status                           角色会话在线状态（按终端标题/名册判定；权威名单见 intercom list）
#   nao-fleet.sh ensure <别名>[@<repo>] [更多...]  拉起角色窗口（默认工作区=roles.yaml workspace）
#   nao-fleet.sh ensure -m <model> <别名>...       显式指定模型（须命中白名单）
#   nao-fleet.sh ensure --task <编号> <别名>[@<repo>]   任务派生会话：--name <别名>-<编号>（并行隔离，避免同名冲突）
#   nao-fleet.sh ensure --force <别名>...          忽略"已在运行"判重
#   nao-fleet.sh close <别名|会话名> [--task <编号>] [--force]
#                                                 回收已完成会话（闸门：在跑 turn / tasks-state 未推进 → 拒绝，--force 跳过）
#
# 角色别名 → 角色卡：见 .agents/roles.yaml（单一事实来源）
#   当前：pm / arch-designer(arch) / rd-fe / rd-be / qa
#
# 环境变量
#   NAO_TERMINAL=ghostty|ptyxis|tmux|screen   强制宿主
#   NAO_TMUX_LAYOUT=main-row2|grid            tmux 布局（默认 main-row2）
#   NAO_TMUX_MAIN_WIDTH=<10..90>              main-row2 主 pane 宽度百分比（默认 35）
#   NAO_SKILLS=<dir>                          角色卡根目录（默认 <脚本>/../..）
#   NAO_MODEL_WHITELIST=<glob,...>            -m 白名单（默认空=不校验，支持 glob）
#   NAO_CLOSE_BUSY_PATTERN=<ERE>             close 的在跑 turn 判定正则（默认内置 pi 状态行标记）
#   NAO_TASKS_STATE=<path>                   任务状态文件（默认 docs/tasks-state.md，供残留检测/回收闸门）
#
# 在线判定（status / close / ensure 判重共用）
#   pi 启动后用 OSC 0 把终端标题设为 "π - <会话名> - <cwd basename>" 并改写 argv
#   （/proc/<pid>/cmdline 只剩 "pi"）⇒ 判定一律面向「终端标题 / pi-intercom 名册 /
#   tmux·screen 会话名」，不使用 `pgrep --name`（历史假阴性根因）。
#   名册经 $PI_AGENT_DIR/npm/node_modules/pi-intercom/cli.ts（一次调用、进程内缓存），
#   不可用时回退 tmux/screen；仍无法确认「不在线」时 close 不做静默 no-op（exit 非 0）。
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
# main-row2 主 pane 宽度百分比：默认值与非法值回退共用同一常量（防三处漂移）
TMUX_MAIN_WIDTH_DEFAULT=35
TMUX_MAIN_WIDTH="${NAO_TMUX_MAIN_WIDTH:-$TMUX_MAIN_WIDTH_DEFAULT}"
# check 输出契约：默认单行摘要（省 PM 上下文），-v 展开完整报告；失败始终展开
VERBOSE=false
# close 的在跑 turn 判定（pi 默认状态行：Working (esc to interrupt) / Thinking... / Retrying / Compacting）
CLOSE_BUSY_PATTERN="${NAO_CLOSE_BUSY_PATTERN:-Working \(|Thinking\.\.\.|to interrupt|to cancel|Retrying \(|Compacting|Summarizing branch}"
# 任务状态文件（相对当前目录；供残留检测与回收闸门）
TASKS_STATE="${NAO_TASKS_STATE:-docs/tasks-state.md}"

log()  { printf '\033[1;32m[fleet]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[fleet]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[fleet]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# roles.yaml 解析（严格子集：顶层 roles:，2 空格角色条目 / 4 空格字段，禁 Tab）
# 填充 ROLE_ORDER / ROLE_CARDS / ROLE_WS / ALIAS_ROLE；解析失败即 die
load_manifest() {
  local f="$MANIFEST" out
  [[ -f "$f" ]] || die "角色清单缺失: $f（请创建 .agents/roles.yaml）"
  out="$(awk -F'\t' '
    function die(msg) { print "ERR: " FNR ": " msg; bad=1 }
    BEGIN { bad=0; in_roles=0; cur=""; n=0 }
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      if ($0 ~ /\t/) { die("禁止 Tab 缩进"); next }
      if (!in_roles) {
        if ($0 ~ /^roles:[[:space:]]*$/) { in_roles=1; next }
        die("顶层仅允许 roles:，得到: " $0); next
      }
      if ($0 ~ /^  [^ ][^:]*:[[:space:]]*$/) {
        cur=$0; sub(/^  /, "", cur); sub(/:[[:space:]]*$/, "", cur)
        if (cur !~ /^[a-z0-9][a-z0-9-]*$/) { die("非法角色 id: " cur); next }
        card[cur]=""; ws[cur]="."; na[cur]=0; order[++n]=cur; next
      }
      if (cur != "" && $0 ~ /^    [a-z_]+:[[:space:]]/) {
        key=$0; sub(/^    /, "", key); sub(/:.*/, "", key)
        val=$0; sub(/^    [a-z_]+:[[:space:]]*/, "", val)
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

# .agents/** 文本文件 EOL 契约：必须全为 LF（出现 CR 即 fail，列出文件）
# 排除 .nao-obsolete/（update 的旧版备份，EOL 不作为契约）
check_eol() {
  local rc=0 n=0 f
  local -a bad=()
  while IFS= read -r -d '' f; do
    n=$((n + 1))
    grep -Iq $'\r' "$f" && bad+=("${f#"$SKILLS_DIR"/}")
  done < <(find "$SKILLS_DIR/.agents" -type f ! -path '*/.nao-obsolete/*' -print0)
  if (( ${#bad[@]} == 0 )); then
    printf '  ✓ %d 个文本文件全 LF\n' "$n"
  else
    rc=1
    printf '  ✗ %d/%d 个文件含 CR（须转 LF；CRLF 会破坏 fleet/awk 解析）:\n' "${#bad[@]}" "$n"
    printf '      %s\n' "${bad[@]}"
  fi
  return $rc
}

# roles.yaml 缩进契约：角色 id 2 空格 / 字段 4 空格 / 禁 Tab（与 load_manifest 解析器同契约，独立报行号）
check_roles_indent() {
  awk '
    BEGIN { in_roles=0; cur=0; bad=0 }
    /^[[:space:]]*$/ { next }
    /^[[:space:]]*#/ { next }
    /\t/ { printf "  ✗ 行 %d: 含 Tab（禁止 Tab 缩进）\n", FNR; bad=1; next }
    !in_roles {
      if ($0 ~ /^roles:[[:space:]]*$/) { in_roles=1; next }
      printf "  ✗ 行 %d: 顶层仅允许 roles:（得到: %s）\n", FNR, $0; bad=1; next
    }
    $0 ~ /^  [^ ][^:]*:[[:space:]]*$/ { cur=1; next }
    cur && $0 ~ /^    [a-z_]+:[[:space:]]/ { next }
    { printf "  ✗ 行 %d: 缩进/位置非法（角色 id 须 2 空格、字段须 4 空格且挂在角色下）: %s\n", FNR, $0; bad=1 }
    END { exit (bad ? 1 : 0) }
  ' "$MANIFEST"
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

# ---------------------------------------------------------------------------
# 会话在线判定
#
# 历史假阴性根因：pi 启动后用 OSC 0 把终端标题设为
#   "π - <会话名> - <cwd basename>"（pi 源码 updateTerminalTitle），
# 并同步改写 argv —— /proc/<pid>/cmdline 只剩 "pi"，`pgrep -f --name` 恒失配，
# 于是 status/close 长期判「不在线」（close 退化为静默空转、exit 0）。
# 现改为按「终端标题契约」取句柄，argv 扫描一律不用：
#   ① pi-intercom 名册（权威在线名单；跨 tmux/ghostty/ptyxis/screen 宿主）
#   ② tmux pane_title（pi 自设；与 pane_start_command 是否为空无关）
#   ③ tmux detached 会话 / screen 会话名 nao-<会话名>
# repo（可选）：给出时要求标题 basename / 名册 cwd 一致，避免跨项目同名会话互串。

PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
PI_TITLE="π"
_INTERCOM_JSON=""; _INTERCOM_PROBED=0

repo_abspath() { ( cd "$1" >/dev/null 2>&1 && pwd ) 2>/dev/null || true; }
repo_basename() {
  local abs; abs="$(repo_abspath "$1")"
  [[ -n "$abs" ]] && printf '%s\n' "${abs##*/}"
  return 0
}

# intercom 名册 JSON（一次调用、进程内缓存）；不可用返回 1（不 die）
intercom_list_json() {
  if (( _INTERCOM_PROBED )); then
    [[ -n "$_INTERCOM_JSON" ]] && printf '%s' "$_INTERCOM_JSON"
    return
  fi
  _INTERCOM_PROBED=1
  local dir="$PI_AGENT_DIR/npm/node_modules/pi-intercom"
  local tsx="$PI_AGENT_DIR/npm/node_modules/tsx/dist/cli.mjs"
  [[ -f "$dir/cli.ts" && -f "$tsx" ]] || return 1
  command -v node >/dev/null 2>&1 || return 1
  local out
  if command -v timeout >/dev/null 2>&1; then
    out="$(timeout 15 node "$tsx" "$dir/cli.ts" list --json 2>/dev/null)" || return 1
  else
    out="$(node "$tsx" "$dir/cli.ts" list --json 2>/dev/null)" || return 1
  fi
  [[ -n "$out" ]] || return 1
  _INTERCOM_JSON="$out"
  printf '%s' "$out"
}

# 名册 → "会话名<TAB>cwd"（每行一条）
intercom_roster() {
  local json; json="$(intercom_list_json)" || return 1
  awk '
    /"name":[[:space:]]*"/ { s=$0; sub(/.*"name":[[:space:]]*"/,"",s); sub(/".*/,"",s); n=s }
    /"cwd":[[:space:]]*"/  { s=$0; sub(/.*"cwd":[[:space:]]*"/,"",s);  sub(/".*/,"",s);  print n "\t" s }
  ' <<< "$json"
}

# 名册中是否在线；repo 给出时须 cwd 精确匹配
intercom_online() {
  local name="$1" repo="${2:-}" abs="" n c
  intercom_list_json >/dev/null 2>&1 || return 1
  if [[ -n "$repo" ]]; then abs="$(repo_abspath "$repo")"; fi
  while IFS=$'\t' read -r n c; do
    [[ "$n" == "$name" ]] || continue
    if [[ -z "$abs" || "$c" == "$abs" ]]; then return 0; fi
  done < <(intercom_roster)
  return 1
}

# 会话所在的 tmux pane（pi 自设标题 "π - <会话名> - <repo basename>"）
find_pane_for() {
  local name="$1" repo="${2:-}" base=""
  command -v tmux >/dev/null 2>&1 || return 0
  if [[ -n "$repo" ]]; then base="$(repo_basename "$repo")"; fi
  tmux list-panes -a -F "#{pane_id}"$'\t'"#{pane_title}" 2>/dev/null \
    | awk -F'\t' -v p="$PI_TITLE" -v n="$name" -v b="$base" '
        { t=$2
          if (b != "") { if (t == p " - " n " - " b) { print $1; exit } }
          else if (index(t, p " - " n " - ") == 1) { print $1; exit }
        }'
}

# 该会话名对应的 pi 进程 PID（经 pane 句柄取 pane_pid 及其子进程中 comm=pi 者）
pi_pids_for() {
  local pane root pid
  pane="$(find_pane_for "$1" "${2:-}")"
  [[ -n "$pane" ]] || return 0
  root="$(tmux display-message -p -t "$pane" '#{pane_pid}' 2>/dev/null)"
  [[ -n "$root" ]] || return 0
  { printf '%s\n' "$root"; pgrep -P "$root" 2>/dev/null || true; } | while IFS= read -r pid; do
    [[ "$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ')" == "pi" ]] || continue
    printf '%s\n' "$pid"
  done
}

running() {
  local name="$1" repo="${2:-}"
  if intercom_online "$name" "$repo"; then return 0; fi
  if [[ -n "$(find_pane_for "$name" "$repo")" ]]; then return 0; fi
  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "nao-$name" 2>/dev/null; then return 0; fi
  if command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[0-9]\.nao-$name\b"; then return 0; fi
  return 1
}

# 能否可信地断言「不在线」：名册可用（完整），或本机就是 tmux/screen 宿主（句柄可枚举）
offline_verifiable() {
  intercom_list_json >/dev/null 2>&1 && return 0
  [[ -n "${TMUX:-}" ]] && return 0
  case "${NAO_TERMINAL:-}" in tmux|screen) return 0 ;; esac
  return 1
}

# 本机可见的会话名（tmux 标题 + tmux/screen 会话 + 名册），供 status 枚举；已去重
visible_session_names() {
  { if command -v tmux >/dev/null 2>&1; then
      tmux list-panes -a -F '#{pane_title}' 2>/dev/null \
        | sed -n "s/^${PI_TITLE} - \([A-Za-z0-9_-]*\) - .*/\1/p"
      tmux list-sessions -F '#{session_name}' 2>/dev/null | sed -n 's/^nao-//p'
    fi
    if command -v screen >/dev/null 2>&1; then
      screen -ls 2>/dev/null | sed -n 's/.*[0-9]\.nao-\([A-Za-z0-9_-]*\).*/\1/p'
    fi
    intercom_roster 2>/dev/null | awk -F'\t' 'NF {print $1}'
  } | awk '!seen[$0]++'
}

# 该 pane 末 3 行是否显示在跑 turn（启发式：状态行标记；回执/产物以 PM 核对清单为准）
pane_busy() {
  local pane="$1" tail3
  tail3="$(tmux capture-pane -p -t "$pane" 2>/dev/null | grep -v '^[[:space:]]*$' | tail -3)"
  [[ -n "$tail3" ]] || return 1
  grep -qE "$CLOSE_BUSY_PATTERN" <<< "$tail3"
}

# 任务在 tasks-state 的归处：
#   active（在表内进行态）/ closed（在归档区表内）/ mentioned（仅散文提及）
#   / absent（全文无记录）/ nofile
# 归一处：表内单元格可选带反引号/**（常见写法 `T157` / **T157**）→ 去首尾空白与标记后比较。
# 标题级别不限（`##` 与 `###` 子表都算）；归档区 = 标题含「已验收|已归档|归档」。
# 边界：先按非 [A-Za-z0-9_-] 切词再比较，避免 T15 命中 T155。
task_state_class() {
  local id="$1"
  [[ -f "$TASKS_STATE" ]] || { echo nofile; return; }
  awk -v id="$id" '
    function norm(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); gsub(/`/, "", s); gsub(/\*\*/, "", s); return s }
    /^#+[[:space:]]/ { sec=$0; sub(/^#+[[:space:]]*/, "", sec); next }
    {
      n=split($0, cells, "|")
      for (i=1;i<=n;i++) {
        if (norm(cells[i]) != id) continue
        if (sec ~ /已验收|已归档|归档/) arch=1; else cell=1
        break
      }
      line=$0; gsub(/[^A-Za-z0-9_-]/, " ", line)
      m=split(line, toks, " ")
      for (j=1;j<=m;j++) if (toks[j]==id) { seen=1; break }
    }
    END {
      if (arch) { print "closed"; exit }
      if (cell) { print "active"; exit }
      if (seen) { print "mentioned"; exit }
      print "absent"
    }
  ' "$TASKS_STATE"
}

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
  [[ "$pct" =~ ^[0-9]+$ ]] || pct="$TMUX_MAIN_WIDTH_DEFAULT"
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
  for d in "$PROMPTS_DIR" "$COMMON_DIR" "$SKILLS_SUB" "$SKILLS_DIR"/.agents/checklists; do
    if [[ -d "$d" ]]; then printf '  ✓ %s\n' "$d"
    else printf '  ✗ 缺失: %s\n' "$d"; rc=1; fi
  done

  echo "== 文本契约（roles.yaml 缩进 2/4 · .agents/** EOL 全 LF）=="
  if [[ -f "$MANIFEST" ]]; then
    if check_roles_indent; then
      printf '  ✓ roles.yaml 缩进契约（角色 id 2 空格 / 字段 4 空格 / 无 Tab）\n'
    else
      rc=1
    fi
  else
    printf '  ✗ roles.yaml 缺失: %s\n' "$MANIFEST"; rc=1
  fi
  check_eol || rc=1

  echo "== 角色清单 roles.yaml =="
  load_manifest
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

  echo "== PR 模板（GitHub Flow）=="
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo '  · 非 git 仓库（跳过）'
  else
    local remote_url prtpl="" cand
    remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    if [[ -z "$remote_url" ]]; then
      echo '  · 无 remote.origin（跳过）'
    elif [[ "$remote_url" != *github.com* ]]; then
      echo '  · 远端非 GitHub（跳过；PR 模板不适用）'
    else
      shopt -s nullglob
      for cand in .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md \
                  .github/PULL_REQUEST_TEMPLATE \
                  pull_request_template.md PULL_REQUEST_TEMPLATE.md \
                  docs/pull_request_template.md docs/PULL_REQUEST_TEMPLATE.md; do
        [[ -e "$cand" ]] && { prtpl="$cand"; break; }
      done
      shopt -u nullglob
      if [[ -n "$prtpl" ]]; then
        printf '  ✓ PR 模板已就位：%s\n' "$prtpl"
      else
        echo '  ! 未找到 PR 模板（GitHub 远端）：PM 立项时从 .agents/templates/github/pull_request_template.md.example 复制为 .github/pull_request_template.md（见 skills/github-flow.md）'
      fi
    fi
  fi

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
        echo '  ! 当前目录索引有未同步变更（codegraph sync）'; rc=1
      else
        echo '  · 当前目录有索引，状态见 codegraph status'
      fi
    else
      echo '  · 当前目录无索引（业务 repo 的索引在 ensure 拉起时检查）'
    fi
  else
    echo '  · codegraph 未安装（回退 grep 属预期行为）'
  fi

  echo "== pi 插件（业界调研能力）=="
  local piset="$HOME/.pi/agent/settings.json"
  if [[ -f "$piset" ]]; then
    if grep -q 'pi-web-access' "$piset" 2>/dev/null; then
      echo '  · pi-web-access ✓ 已装（PM/arch 业界调研可用）'
    else
      echo '  ! pi-web-access 未装（业界调研不可用；nao-skill plugins install web-access）'
    fi
  else
    echo "  · 未找到 $piset（跳过插件检测）"
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
      printf '  ! NAO_TMUX_MAIN_WIDTH=%-3s  非法（10..90）：越界夹取到 10/90，非数字回退 %s\n' "$TMUX_MAIN_WIDTH" "$TMUX_MAIN_WIDTH_DEFAULT"
    fi
  fi

  if [[ "$strict" == "true" && $wl_problems -gt 0 ]]; then
    warn "strict 模式：白名单发现 $wl_problems 项问题（空条目/重复/过宽）"
    rc=1
  fi

  return $rc
}

# ---------------------------------------------------------------------------
cmd_status() {
  local a
  intercom_list_json >/dev/null 2>&1 || true   # 预热名册缓存（后续子 shell 复用）
  echo "== 角色会话在线状态（权威名单见 intercom({action:'list'})；本表按终端标题/名册判定）=="
  for a in "${ROLE_ORDER[@]}"; do
    if running "$a" "${ROLE_WS[$a]:-}"; then
      printf '  ✓ %-14s 在线（--name %s；卡片 %s）\n' "$a" "$a" "${ROLE_CARDS[$a]}"
    else
      printf '  · %-14s 未运行（ensure 拉起）\n' "$a"
    fi
  done
  echo "== 任务派生会话（--task 拉起，如 rd-be-T1）=="
  local found=0 dname role id cls tag
  while IFS= read -r dname; do
    [[ -n "$dname" ]] || continue
    id=""
    for role in "${ROLE_ORDER[@]}"; do [[ "$dname" == "$role-"* ]] && { id="${dname#"$role"-}"; break; }; done
    [[ -n "$id" ]] || continue
    cls="$(task_state_class "$id")"
    tag=""
    case "$cls" in
      closed)    tag="  ! 残留（$id 已归档）→ close --task $id ${dname%-*}" ;;
      active)    tag="  · $id 进行态" ;;
      mentioned) tag="  ? $id 仅散文提及（非表内记录）→ 核对后 close --task $id ${dname%-*}" ;;
      absent)    tag="  ! 残留（tasks-state 无 $id 记录）→ 核对后 close --task $id ${dname%-*}" ;;
    esac
    printf '  · %s%s\n' "$dname" "$tag"
    found=1
  done < <(visible_session_names)
  (( found )) || echo '  （无）'
  [[ -f "$TASKS_STATE" ]] || echo "  （$TASKS_STATE 不存在，残留判定已跳过）"
}

# ---------------------------------------------------------------------------
# 回收已完成会话：闸门（tasks-state 已推进 + 无在跑 turn）+ 落地（pane/会话/screen/进程）
cmd_close() {
  local force="$1" task="$2" target="$3"
  [[ -n "$target" ]] || die "close 需要目标：角色别名或派生会话名（如 rd-be / rd-be-T1）"
  local name repo cls bus pane pids r ok
  intercom_list_json >/dev/null 2>&1 || true   # 预热名册缓存
  if [[ -n "$task" ]]; then
    resolve_role "$target"
    name="${NAME}-${task}"
    repo="${ROLE_WS[$NAME]:-$PWD}"
    # 闸门①：tasks-state 未推进 → 拒绝（验收未过需原会话返工，回收会丢上下文）
    cls="$(task_state_class "$task")"
    if [[ "$cls" == "active" && "$force" != true ]]; then
      warn "拒绝回收 $name：tasks-state 中 $task 仍在进行态（未验收/未归档）"
      warn "  先把 $task 移入「已验收/已归档」再回收（或 --force：将丢失打回返工所需上下文）"
      return 1
    fi
    [[ "$cls" == "absent" ]] && warn "tasks-state 全文无 $task 记录（仅按会话名回收）"
    [[ "$cls" == "mentioned" ]] && log "tasks-state 仅散文提及 $task（非表内记录，不阻塞回收）"
    [[ "$cls" == "nofile" ]] && log "未启用 $TASKS_STATE（跳过状态闸门）"
  elif [[ -n "${ALIAS_ROLE[$target]:-}" ]]; then
    name="${ALIAS_ROLE[$target]}"; repo="${ROLE_WS[$name]:-$PWD}"
    warn "常驻会话 $name：任务闭环后应 ensure --force 重开，而非回收（仅在本批不再需要该角色时回收）"
  else
    name="$target"
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || die "非法会话名: $name"
    # 非别名的目标必须是 <已知角色>-<编号>，否则视为拼错（防静默 no-op）
    ok=0
    for r in "${ROLE_ORDER[@]}"; do [[ "$name" == "$r-"* ]] && ok=1; done
    (( ok )) || die "未知角色或派生会话名: $name（可用: ${ROLE_ORDER[*]}；派生名形如 rd-be-T1）"
    repo="$PWD"
  fi

  if ! running "$name" "$repo"; then
    if offline_verifiable; then
      log "$name 未运行（无需回收）"; return 0
    fi
    warn "无法确认 $name 在线状态：宿主无 tmux/screen 句柄，且 pi-intercom 名册不可用"
    warn "  pi 启动后 argv 被改写为 \"pi\"，进程扫描不可信 ⇒ 不做静默 no-op（本命令 exit 非 0）"
    warn "  请用 intercom list 人工核对；确认已退出后忽略本提示，或用 --force 跳过闸门"
    return 1
  fi

  # 闸门②：在跑 turn（tmux 可判；非 tmux 宿主无法判 → 需 --force）
  pane="$(find_pane_for "$name" "$repo")"
  if [[ -n "$pane" ]]; then
    pane_busy "$pane" && bus="tmux pane $pane 末行显示在跑 turn"
  else
    bus="非 tmux 宿主，无法确认是否在跑 turn"
  fi
  if [[ -n "$bus" && "$force" != true ]]; then
    warn "拒绝回收 $name：$bus"
    warn "  等它停；回执与产物核对见 checklists/pm.md「会话回收 / 收窗核对」（或 --force 强制）"
    return 1
  fi

  if [[ -n "$pane" ]] && tmux kill-pane -t "$pane" 2>/dev/null; then
    log "已回收 $name（tmux pane $pane）@ $repo"; return 0
  fi
  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "nao-$name" 2>/dev/null && tmux kill-session -t "nao-$name" 2>/dev/null; then
    log "已回收 $name（tmux 会话 nao-$name）@ $repo"; return 0
  fi
  if command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "nao-$name" && screen -S "nao-$name" -X quit 2>/dev/null; then
    log "已回收 $name（screen 会话 nao-$name）@ $repo"; return 0
  fi
  pids="$(pi_pids_for "$name" "$repo" | tr '\n' ' ')"
  if [[ -n "$pids" ]] && kill $pids 2>/dev/null; then
    log "已回收 $name（结束进程: $pids）@ $repo"; return 0
  fi
  warn "未找到 $name 的 pane/会话/进程（可能刚好退出）"; return 1
}

# ---------------------------------------------------------------------------
cmd_ensure() {
  local force="$1" model="$2" task="$3"; shift 3
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
    # 任务派生：会话名 = <角色>-<任务编号>，独立 intercom 身份（并行隔离，避免同名冲突）
    local disp="$NAME"
    [[ -n "$task" ]] && disp="${NAME}-${task}"
    # CodeGraph 索引健康（同 repo 只查一次，不阻塞拉起）
    key="$repo"; seen=0
    for k in "${cg_done[@]:-}"; do [[ "$k" == "$key" ]] && seen=1; done
    if (( ! seen )); then check_codegraph "$repo"; cg_done+=("$key"); fi
    if [[ "$force" != "true" ]] && running "$disp" "$repo"; then
      warn "$disp 已在运行（终端标题/名册命中），跳过；确需重开请加 --force"
      continue
    fi
    spawn_one "$disp" "$repo" "$model"
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
CMD=""; FORCE=false; STRICT=false; MODEL=""; TASK=""; TARGETS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    check)  CMD="check";  shift ;;
    status) CMD="status"; shift ;;
    close)  CMD="close";  shift ;;
    ensure) CMD="ensure"; shift ;;
    -m|--model)
      MODEL="${2:-}"
      [[ -n "$MODEL" ]] || die "-m 需要模型参数"
      check_model "$MODEL" || die "模型 '$MODEL' 不在白名单内。允许: $MODEL_WHITELIST（可通过 NAO_MODEL_WHITELIST 覆盖）"
      shift 2 ;;
    --force)  FORCE=true;  shift ;;
    --task)   TASK="${2:-}"; [[ -n "$TASK" ]] || die "--task 需要任务编号（如 T1）"; [[ "$TASK" =~ ^[A-Za-z0-9_-]+$ ]] || die "--task 非法: $TASK（仅字母/数字/-/_）"; shift 2 ;;
    --strict) STRICT=true; shift ;;
    -v|--verbose) VERBOSE=true; shift ;;
    -h|--help) usage ;;
    *) TARGETS+=("$1"); shift ;;
  esac
done

case "$CMD" in
  check)  : ;;   # cmd_check 自行先做文本契约体检，再 load_manifest（缩进违例时也能先出报告）
  ensure|status|close) load_manifest ;;
esac

case "$CMD" in
  check)
    # 默认单行摘要（派发前自检只需 exit code + 计数；完整报告 30+ 行不进 PM 上下文）；-v 或失败时展开
    # 子 shell 隔离：cmd_check 内部 die/exit 不得吞掉报告（计数从报告解析，不靠子 shell 内变量）
    REPFILE="$(mktemp)"
    set +e
    ( cmd_check "$STRICT" ) >"$REPFILE" 2>&1
    CHECK_RC=$?
    set -e
    if (( CHECK_RC == 0 )) && ! $VERBOSE; then
      WARNS="$(grep -c '^  !' "$REPFILE" || true)"
      ROLES_N="$(grep -oE '解析成功，[0-9]+ 个角色' "$REPFILE" | grep -oE '[0-9]+' | head -1 || true)"
      FILES_N="$(grep -oE '[0-9]+ 个文本文件全 LF' "$REPFILE" | grep -oE '^[0-9]+' | head -1 || true)"
      if (( WARNS > 0 )); then
        printf 'check: OK · roles=%s · files=%s · layout=%s · warn=%d（-v 看详情）\n' \
          "${ROLES_N:-?}" "${FILES_N:-?}" "$TMUX_LAYOUT" "$WARNS"
      else
        printf 'check: OK · roles=%s · files=%s · layout=%s\n' \
          "${ROLES_N:-?}" "${FILES_N:-?}" "$TMUX_LAYOUT"
      fi
    else
      cat "$REPFILE"
    fi
    rm -f "$REPFILE"
    exit $CHECK_RC
    ;;
  status) cmd_status ;;
  close)  cmd_close "$FORCE" "$TASK" "${TARGETS[0]:-}" ;;
  ensure) cmd_ensure "$FORCE" "$MODEL" "$TASK" "${TARGETS[@]}" ;;
  *) usage ;;
esac