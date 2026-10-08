#!/usr/bin/env bash
# =============================================================================
# T506-2 · 用例先行 + 独立验证脚本
#   nao-todo 迁移到 nao-skill 0.12.0（pi 原生包形态 / shim 转发）
#
# 断言来源（正文权威）：docs/prds/2026-10-08-nao-fleet-0.12.0-migration.md
#   §7 AC1–AC6 · §6 NFR · §2 目标指标 · §3 范围
#
# 用法
#   bash docs/reports/2026-10-08-T506-nao-fleet-migration-verify.sh [项目根]
#
# 环境开关
#   T506_SKIP_GATES=1    跳过 vp check / guard:gate-pathspec（批末全仓门禁另跑）
#   T506_REAL_DEGRADED=1 额外在真树做「临时移走 .pi/npm」负向（须独占窗口；自动恢复）
#   T506_ROLLBACK=1      额外做「git worktree 里 revert 本批提交后 check exit 0」
#
# 纪律：默认只读被测树。负向用 temp fixture；回滚用 git worktree（不动主工作区）。
# =============================================================================
set -uo pipefail

PROJ="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PROJ="$(cd "$PROJ" && pwd)"
cd "$PROJ"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/t506-verify.XXXXXX")"
EMPTY_HOME="$TMP/emptyhome"; mkdir -p "$EMPTY_HOME"
restore_npm() { [ -d "$PROJ/.pi/npm.t506bak" ] && mv "$PROJ/.pi/npm.t506bak" "$PROJ/.pi/npm" 2>/dev/null || true; }
cleanup() { restore_npm; rm -rf "$TMP"; }
trap cleanup EXIT

PASS=0; FAIL=0; WARN=0
G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; N=$'\033[0m'
pass(){ PASS=$((PASS+1)); printf '%s[PASS]%s %s\n' "$G" "$N" "$*"; }
fail(){ FAIL=$((FAIL+1)); printf '%s[FAIL]%s %s\n' "$R" "$N" "$*"; }
warn(){ WARN=$((WARN+1)); printf '%s[WARN]%s %s\n' "$Y" "$N" "$*"; }
info(){ printf '%s[INFO]%s %s\n' "$D" "$N" "$*"; }
hdr(){ printf '\n%s===== %s =====%s\n' "$D" "$*" "$N"; }

assert_eq(){  [ "$1" = "$2" ] && pass "$3 (= $2)" || fail "$3 (expected [$1] got [$2])"; }
assert_ne(){  [ "$1" != "$2" ] && pass "$3 (= $2)" || fail "$3 (unexpectedly = $1)"; }
assert_file(){ [ -f "$1" ] && pass "$2" || fail "$2 (missing file $1)"; }
assert_dir(){  [ -d "$1" ] && pass "$2" || fail "$2 (missing dir $1)"; }
assert_absent(){ [ ! -e "$1" ] && pass "$2" || fail "$2 (still exists: $1)"; }
assert_contains(){ case "$1" in *"$2"*) pass "$3";; *) fail "$3 (output lacks [$2])";; esac; }
assert_not_contains(){ case "$1" in *"$2"*) fail "$3 (output unexpectedly has [$2])";; *) pass "$3";; esac; }

# 统计「裸 .agents/<suffix>」引用数（排除 $NAO_SKILLS/.agents/ 前缀）
bare_count(){ sed 's|\$NAO_SKILLS/\.agents/|@MECH@/|g' "$1" 2>/dev/null | grep -oF ".agents/$2" 2>/dev/null | wc -l | tr -d ' '; }

# 经项目内 shim 调 fleet（清掉可能干扰的显式覆盖；返回 RC/OUT/ERR）
shim(){ local d="$1"; shift
  ( cd "$d" && env -u NAO_SKILLS -u NAO_SHIM_ENTERED -u PI_CODING_AGENT_DIR \
      bash .agents/scripts/nao-fleet.sh "$@" ) >"$TMP/o" 2>"$TMP/e"
  RC=$?; OUT="$(cat "$TMP/o")"; ERR="$(cat "$TMP/e")"
}

# 解析 pin 的机制包根（与 shim D6 同源逻辑，仅用于取包内脚本路径）
PKG_ROOT="$(node -e '
  const fs=require("fs"),path=require("path");
  const proj=process.argv[1];
  let s; try{ s=JSON.parse(fs.readFileSync(path.join(proj,".pi/settings.json"),"utf8")); }catch{ process.exit(0); }
  for(const raw of (s.packages||[])){
    const m=/^npm:(.+?)(?:@([^@\/]+))?$/.exec(String(raw)); if(!m) continue;
    let name=m[1]; if(name.startsWith("@")&&name.includes("/@")) name=name.slice(0,name.indexOf("/@"));
    try{
      const pj=require.resolve(name+"/package.json",{paths:[path.join(proj,".pi/npm/node_modules")]});
      const root=path.dirname(pj);
      if(fs.existsSync(path.join(root,".agents","scripts","nao-fleet.sh"))){ process.stdout.write(root); break; }
    }catch{}
  }
' "$PROJ" 2>/dev/null)"

printf 'T506 独立验证 · 项目根 = %s\n' "$PROJ"
info "解析到的机制包根 = ${PKG_ROOT:-<未物化>}"

# ---------------------------------------------------------------------------
hdr "前置：迁移态与物化"
assert_file "$PROJ/.agents/.nao-migrated" "前置: .agents/.nao-migrated 存在（迁移已执行）"
if [ -n "$PKG_ROOT" ]; then
  pass "前置: 机制包已物化（$PKG_ROOT）"
  assert_eq "0.12.0" "$(node -p 'require(process.argv[1]).version' "$PKG_ROOT/package.json" 2>/dev/null)" "前置: 机制包版本 0.12.0"
else
  fail "前置: 机制包未物化（.pi/npm 缺 @nathan33/nao-skill）"
fi

# ---------------------------------------------------------------------------
hdr "AC1 主路径：足迹收敛 + shim check"
for d in prompts common checklists templates; do
  assert_absent "$PROJ/.agents/$d" "AC1: .agents/$d 已移除（机制副本不落项目）"
done
assert_absent "$PROJ/.agents/roles.yaml" "AC1: .agents/roles.yaml 已移除"
assert_eq "nao-fleet.sh" "$(ls -A "$PROJ/.agents/scripts" 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')" "AC1: .agents/scripts/ 仅 shim nao-fleet.sh"
assert_contains "$(head -40 "$PROJ/.agents/scripts/nao-fleet.sh" 2>/dev/null)" "NAO_SHIM_ENTERED" "AC1: 项目内 nao-fleet.sh 是 shim（含 NAO_SHIM_ENTERED）"
assert_not_contains "$(cat "$PROJ/.agents/scripts/nao-fleet.sh" 2>/dev/null)" "cmd_ensure" "AC1: shim 非旧版全量脚本（哨兵 cmd_ensure 不存在）"
assert_eq "0.12.0" "$(tr -d '[:space:]' < "$PROJ/.agents/.nao-version" 2>/dev/null)" "AC1: .agents/.nao-version = 0.12.0"
assert_eq "0.12.0" "$(tr -d '[:space:]' < "$PROJ/.agents/.nao-migrated" 2>/dev/null)" "AC1: .agents/.nao-migrated = 0.12.0"

top="$(ls -A "$PROJ/.agents" 2>/dev/null | sort | tr '\n' ' ')"
info "AC1: .agents/ 顶层实测 = [$top]"
for e in .nao-migrated .nao-obsolete .nao-version scripts; do
  [ -e "$PROJ/.agents/$e" ] && pass "AC1: 顶层机制项存在 $e" || fail "AC1: 顶层机制项缺失 $e"
done
extra="$(ls -A "$PROJ/.agents" 2>/dev/null | grep -vE '^(\.nao-migrated|\.nao-obsolete|\.nao-version|scripts|skills)$' || true)"
assert_eq "" "$extra" "AC1: 除「4 机制项 + skills/」外无其它顶层条目"
if [ -d "$PROJ/.agents/skills" ]; then
  assert_eq "nue-ui" "$(ls -A "$PROJ/.agents/skills" 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')" "AC1/AC2: .agents/skills/ 仅装项目自有 nue-ui"
  info "AC1 口径注记：PRD AC1 原写「顶层仅 4 项」，与 AC2（保留 .agents/skills/nue-ui）互斥；PM 2026-10-08 已订正判据 =「机制类归零 + 自有资产保留」⇒ 顶层实测 5 项（4 机制项 + skills/）。此处按订正后判据判定。"
else
  fail "AC1/AC2: .agents/skills/ 不存在（项目自有 nue-ui 丢失）"
fi

shim "$PROJ" check
assert_eq "0" "$RC" "AC1: 经 shim 的 fleet check exit=0"
assert_contains "$OUT$ERR" "check: OK" "AC1: check 输出含 'check: OK'"
assert_contains "$OUT$ERR" "roles=6" "AC1: check 报 roles=6"
assert_not_contains "$OUT$ERR" "DEGRADED" "AC1: 正常路径无 DEGRADED"

# ---------------------------------------------------------------------------
hdr "AC2 边界：自有 skill 保留 / nao 资产移除且备份"
assert_file "$PROJ/.agents/skills/nue-ui/SKILL.md" "AC2: 自有 skill .agents/skills/nue-ui/SKILL.md 保留"
assert_absent "$PROJ/.agents/skills/frontend-design" "AC2: nao 资产 .agents/skills/frontend-design 已从 live 移除"
assert_dir "$PROJ/.agents/.nao-obsolete" "AC2: .agents/.nao-obsolete/ 备份目录存在"
fd_bak="$(find "$PROJ/.agents/.nao-obsolete" -path '*frontend-design*' 2>/dev/null | head -1)"
[ -n "$fd_bak" ] && pass "AC2: 备份含 frontend-design（${fd_bak#$PROJ/}）" || fail "AC2: 备份未含 frontend-design"
mech_bak="$(find "$PROJ/.agents/.nao-obsolete" \( -name 'roles.yaml' -o -name 'product-manager.md' -o -name 'qa.md' -o -name 'pm-operations.md' \) 2>/dev/null | head -1)"
[ -n "$mech_bak" ] && pass "AC2: 备份含旧机制资产（${mech_bak#$PROJ/}）" || fail "AC2: 备份未含旧机制资产"
ob_n="$(find "$PROJ/.agents/.nao-obsolete" -type f 2>/dev/null | wc -l | tr -d ' ')"
info "AC2: .nao-obsolete 备份文件数 = $ob_n（应 >= 5）"
[ "$ob_n" -ge 5 ] && pass "AC2: 备份文件数 >= 5" || fail "AC2: 备份文件数不足（$ob_n）"
git check-ignore -q ".agents/.nao-obsolete/" && pass "AC2/NFR: .agents/.nao-obsolete/ 被 git 忽略（BR4 不入库）" || fail "AC2/NFR: .agents/.nao-obsolete/ 未被 git 忽略"

# ---------------------------------------------------------------------------
hdr "AC3 设计一致性：AGENTS.md / docs/tasks-state.md 机制路径"
assert_contains "$(cat "$PROJ/AGENTS.md" 2>/dev/null)" '$NAO_SKILLS/.agents/' "AC3: AGENTS.md 引入 \$NAO_SKILLS/.agents/ 指针"
assert_contains "$(cat "$PROJ/AGENTS.md" 2>/dev/null)" '$NAO_SKILLS/.agents/scripts/qq-notify' "AC3: qq-notify 调用改为 \$NAO_SKILLS/.agents/scripts/qq-notify"
assert_not_contains "$(cat "$PROJ/AGENTS.md" 2>/dev/null)" '必须保持 `LF`' "AC3: 「.agents/** 必须保持 LF」硬规则段已作废/改写"
for p in 'roles.yaml' 'prompts/' 'checklists/' 'common/' 'templates/'; do
  n="$(bare_count "$PROJ/AGENTS.md" "$p")"
  assert_eq "0" "$n" "AC3: AGENTS.md 无裸引用 .agents/$p（排除 \$NAO_SKILLS/ 前缀）"
done
ts_n="$(grep -cF '$NAO_SKILLS/.agents/' "$PROJ/docs/tasks-state.md" 2>/dev/null || true)"
if [ "$ts_n" -gt 0 ]; then
  pass "AC3: docs/tasks-state.md 含 \$NAO_SKILLS/.agents/（$ts_n 处）"
else
  warn "AC3: docs/tasks-state.md 未见 \$NAO_SKILLS/.agents/（PRD AC3 要求 10 处机制路径更新 —— 请人工核对）"
fi

# ---------------------------------------------------------------------------
hdr "AC4 配置：.gitignore 放行 pin / settings 内容 / APPEND_SYSTEM 未动"
if git check-ignore -q ".pi/settings.json"; then fail "AC4: .pi/settings.json 仍被忽略（应为 !.pi/settings.json 放行）"; else pass "AC4: .pi/settings.json 未被忽略（可入库）"; fi
if git check-ignore -q ".pi/npm/node_modules/@nathan33/nao-skill/package.json"; then pass "AC4: .pi/npm/** 仍被忽略"; else fail "AC4: .pi/npm/** 未被忽略"; fi
if git check-ignore -q ".pi/APPEND_SYSTEM.md"; then pass "AC4/V3: .pi/APPEND_SYSTEM.md 仍被忽略"; else fail "AC4/V3: .pi/APPEND_SYSTEM.md 未被忽略"; fi
if git ls-files --error-unmatch .pi/settings.json >/dev/null 2>&1; then pass "AC4: .pi/settings.json 已入库（团队 clone 即知 pin）"; else warn "AC4: .pi/settings.json 尚未入库（若在验证时未提交，请复核）"; fi
pin="$(node -e 'const s=require(process.argv[1]);const a=(s.packages||[]).filter(p=>/nao-skill/.test(p));process.stdout.write(a.join(","))' "$PROJ/.pi/settings.json" 2>/dev/null)"
assert_eq "npm:@nathan33/nao-skill@0.12.0" "$pin" "AC4: settings pin = npm:@nathan33/nao-skill@0.12.0"
assert_eq "8a7082f6cccf32abcfb5e1e851e1a0e7" "$(md5sum "$PROJ/.pi/APPEND_SYSTEM.md" 2>/dev/null | awk '{print $1}')" "AC4/V3: .pi/APPEND_SYSTEM.md 内容未变（md5 基线）"

# ---------------------------------------------------------------------------
hdr "AC5 门禁（fleet check / vp check / guard:gate-pathspec / 移动端红线）"
shim "$PROJ" check
assert_eq "0" "$RC" "AC5: fleet check exit=0"
redline="$(git status --porcelain -- packages/presentation-react apps/mobile 2>/dev/null)"
assert_eq "" "$redline" "AC5: 移动端红线 git status --porcelain == 0"
if [ "${T506_SKIP_GATES:-}" = "1" ]; then
  info "AC5: 跳过 vp check / guard:gate-pathspec（T506_SKIP_GATES=1；由批末全仓门禁统一跑）"
else
  ( pnpm exec vp check ) >"$TMP/vpc.log" 2>&1; rc=$?
  assert_eq "0" "$rc" "AC5: pnpm exec vp check exit=0"
  tail -3 "$TMP/vpc.log" | sed 's/^/[vp check] /'
  ( pnpm run guard:gate-pathspec ) >"$TMP/gp.log" 2>&1; rc=$?
  assert_eq "0" "$rc" "AC5: pnpm run guard:gate-pathspec exit=0"
fi

# ---------------------------------------------------------------------------
hdr "AC6 负向闭环：旧命令经 shim / qq-notify / 缺包降级"
shim "$PROJ" status
assert_eq "0" "$RC" "AC6: shim status exit=0（旧命令仍可用）"
shim "$PROJ" ensure __t506_probe__
assert_ne "0" "$RC" "AC6: shim ensure 对未知角色非 0（证明转发到包内 fleet，未静默）"
assert_contains "$OUT$ERR" "未知角色" "AC6: ensure 报错来自包内 fleet（未知角色）"

if [ -n "$PKG_ROOT" ] && [ -x "$PKG_ROOT/.agents/scripts/qq-notify" ]; then
  pass "AC6: \$NAO_SKILLS/.agents/scripts/qq-notify 存在且可执行"
  ( "$PKG_ROOT/.agents/scripts/qq-notify" --dry-run "T506 qa dry-run" ) >"$TMP/qq.log" 2>&1; rc=$?
  assert_eq "0" "$rc" "AC6: qq-notify --dry-run \"文本\" exit=0（连通性自检）"
  assert_contains "$(cat "$TMP/qq.log")" "dry-run" "AC6: qq-notify dry-run 输出可辨认"
  # 发现登记：PRD/派单写的裸 `qq-notify --dry-run`（不带文本）实际 rc=1（参数错）
  ( "$PKG_ROOT/.agents/scripts/qq-notify" --dry-run ) >"$TMP/qq2.log" 2>&1; rc2=$?
  info "AC6 口径更正：裸 \`qq-notify --dry-run\`（无文本）实测 rc=$rc2 —— 正确形式须带文本：\`qq-notify --dry-run \"文本\"\`"
else
  fail "AC6: 包内 qq-notify 不存在或不可执行"
fi

# 缺包降级：temp fixture（不动真树）
fx="$TMP/fixture-proj"; mkdir -p "$fx/.agents/scripts" "$fx/.pi" "$fx/home"
cp "$PROJ/.agents/scripts/nao-fleet.sh" "$fx/.agents/scripts/nao-fleet.sh"
printf '{"packages":["npm:@nathan33/nao-skill@0.12.0"]}\n' > "$fx/.pi/settings.json"
( cd "$fx" && env -u NAO_SKILLS -u NAO_SHIM_ENTERED -u PI_CODING_AGENT_DIR HOME="$fx/home" \
    bash .agents/scripts/nao-fleet.sh check ) >"$TMP/d.log" 2>&1; rc=$?
joined="$(cat "$TMP/d.log")"
assert_eq "2" "$rc" "AC6/NFR3: 缺包场景 shim exit=2"
assert_eq "1" "$(printf '%s\n' "$joined" | grep -cE '^DEGRADED:' || true)" "AC6/NFR3: 恰一行 DEGRADED:"
assert_contains "$joined" "pi install" "AC6/NFR3: 含可复制恢复命令（pi install）"
assert_not_contains "$joined" "check: OK" "AC6/NFR3: 不静默成功"

# 真树缺包（需独占窗口）
if [ "${T506_REAL_DEGRADED:-}" = "1" ]; then
  if [ -d "$PROJ/.pi/npm" ]; then
    mv "$PROJ/.pi/npm" "$PROJ/.pi/npm.t506bak"
    ( cd "$PROJ" && env -u NAO_SKILLS -u NAO_SHIM_ENTERED -u PI_CODING_AGENT_DIR HOME="$EMPTY_HOME" \
        bash .agents/scripts/nao-fleet.sh check ) >"$TMP/rd.log" 2>&1; rc=$?
    restore_npm
    joined="$(cat "$TMP/rd.log")"
    assert_eq "2" "$rc" "AC6/NFR3(真树): 移走 .pi/npm 后 shim exit=2"
    assert_eq "1" "$(printf '%s\n' "$joined" | grep -cE '^DEGRADED:' || true)" "AC6/NFR3(真树): 恰一行 DEGRADED:"
    assert_contains "$joined" "pi install" "AC6/NFR3(真树): 含恢复命令"
    info "AC6/NFR3(真树): .pi/npm 已恢复（$( [ -d "$PROJ/.pi/npm" ] && echo ok || echo MISSING )）"
  else
    warn "AC6/NFR3(真树): .pi/npm 不存在，跳过"
  fi
else
  info "AC6/NFR3(真树): 未启用（T506_REAL_DEGRADED=1 时在独占窗口执行）"
fi

# ---------------------------------------------------------------------------
hdr "AC6 / NFR1 回滚：git worktree 内 revert 本批提交后 fleet check exit=0"
if [ "${T506_ROLLBACK:-}" = "1" ]; then
  base="$(git merge-base origin/main HEAD 2>/dev/null || git rev-parse origin/main 2>/dev/null || echo '')"
  if [ -z "$base" ]; then
    warn "AC6/NFR1: 无法确定 origin/main 基线，跳过回滚实测"
  else
    wt="$TMP/wt-rollback"
    if git worktree add --detach "$wt" HEAD >/dev/null 2>&1; then
      revs="$(git rev-list "$base..HEAD")"   # 逆时序（新→旧）——撤销一批提交须从新到旧，避免同文件冲突
      ok=1
      for c in $revs; do ( cd "$wt" && git revert --no-edit "$c" ) >/dev/null 2>&1 || ok=0; done
      if [ "$ok" = "1" ]; then
        pass "AC6/NFR1: worktree 内逆时序 revert 本批 $(printf '%s' "$revs" | wc -w | tr -d ' ') 个提交成功"
        assert_dir "$wt/.agents/prompts" "AC6/NFR1: revert 后旧机制目录 .agents/prompts 恢复"
        assert_absent "$wt/.agents/.nao-migrated" "AC6/NFR1: revert 后 .nao-migrated 消失（回到 0.11 形态）"
        ( cd "$wt" && env -u NAO_SKILLS -u NAO_SHIM_ENTERED bash .agents/scripts/nao-fleet.sh check ) >"$TMP/rb.log" 2>&1; rc=$?
        assert_eq "0" "$rc" "AC6/NFR1: revert 后 .agents/scripts/nao-fleet.sh check exit=0"
        tail -1 "$TMP/rb.log" | sed 's/^/[rollback check] /'
      else
        fail "AC6/NFR1: worktree 内 revert 失败（冲突或非本批提交）"
      fi
      git worktree remove --force "$wt" >/dev/null 2>&1 || true
    else
      fail "AC6/NFR1: git worktree add 失败"
    fi
  fi
else
  info "AC6/NFR1 回滚：未启用（T506_ROLLBACK=1 时执行）"
fi

# ---------------------------------------------------------------------------
hdr "AC7/AC8 治理与非范围守护（git 口径）"
base="$(git merge-base origin/main HEAD 2>/dev/null || git rev-parse origin/main 2>/dev/null || echo '')"
if [ -n "$base" ]; then
  n="$(git rev-list --count "$base..HEAD" 2>/dev/null || echo '?')"
  info "AC7: 分支提交数 = $n（AC7 的「恰好 1 条」在 squash 合并后的 main 上成立；分支可含 PRD 收录 + 迁移等多条）"
  [ "$n" = "1" ] && pass "AC7: 分支已收敛为 1 条提交" || warn "AC7: 分支为 $n 条提交（squash 后 main 应为 1 条）"
  wipn="$(git log --format=%s "$base..HEAD" 2>/dev/null | grep -ciE '^wip[(:]' || true)"
  assert_eq "0" "$wipn" "AC7: 无 wip() 提交"
  st="$(git diff --name-status "$base..HEAD" 2>/dev/null)"
  for p in '^packages/' '^apps/' '^vite\.config\.ts$'; do
    hit="$(printf '%s\n' "$st" | awk '{print $2}' | grep -E "$p" | head -3 | tr '\n' ' ')"
    assert_eq "" "$hit" "AC8: 本批未触碰 $p"
  done
  for p in '^docs/adr/' '^docs/prds/' '^docs/releases/' '^docs/reports/'; do
    hit="$(printf '%s\n' "$st" | awk '$1!="A"{print $2}' | grep -E "$p" | head -3 | tr '\n' ' ')"
    assert_eq "" "$hit" "AC8: 本批未修改/删除历史归档 $p（仅允许新增）"
  done
else
  warn "AC7/AC8: 无 origin/main 基线，跳过"
fi

# ---------------------------------------------------------------------------
hdr "汇总"
printf 'PASS=%d  FAIL=%d  WARN=%d\n' "$PASS" "$FAIL" "$WARN"
if [ "$FAIL" -eq 0 ]; then printf '%sALL GREEN%s（warn=%d）\n' "$G" "$N" "$WARN"; exit 0; else printf '%sFAIL=%d%s\n' "$R" "$FAIL" "$N"; exit 1; fi
