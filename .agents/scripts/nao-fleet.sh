#!/usr/bin/env bash
# =============================================================================
# nao-fleet.sh — 项目内兼容 shim（nao 机制包才是单一事实来源）
#
# 作用：定位 nao 机制包根，并把全部参数原样转发给包内
#       `<包根>/.agents/scripts/nao-fleet.sh`。
#
# 解析序（D6）：
#   1) NAO_SKILLS（显式）—— 直接采用（须含 .agents/scripts/nao-fleet.sh）
#   2) 项目 .pi/npm（pin 主）—— 遍历 .pi/settings.json 的 npm 声明，node resolve
#      出「含 nao 机制」的包，版本须与声明一致
#   3) ~/.pi/agent/npm —— 仅当版本与 pin 完全一致时采用
#   4) 显式失败（exit 2 + 单行 DEGRADED:）
# 约定：按机制存在性识别包，**不硬编码包名**。
#
# 防重入（D7，双防护）：
#   ① 环境标记 NAO_SHIM_ENTERED=1 已存在 ⇒ 立即失败（防 shim→shim 递归）
#   ② 解析出的包根 == shim 自身所属项目根 ⇒ 立即失败（防自指）
#
# 纪律：nao 机制自身零网络；本 shim 只用 node resolve，不调用 pi / npm 可执行文件。
# 生成：由 `nao-skill init` / `nao-skill migrate` 写入，勿手工编辑。
# =============================================================================
set -euo pipefail

SHIM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$(cd "$SHIM_DIR/.." && pwd)"
PROJ_ROOT="$(cd "$AGENTS_DIR/.." && pwd)"
SETTINGS="$PROJ_ROOT/.pi/settings.json"
GLOBAL_MOD="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules"

DEGRADED_HINT='恢复：在项目根执行 `pi install -l --approve npm:@nathan33/nao-skill@<pin>`（或运行 pi 让其自动物化），再重试'

degrade() {
  printf 'DEGRADED: %s；%s\n' "$1" "$DEGRADED_HINT" >&2
  exit 2
}

# D7①：标记命中即失败（防递归；也防 stale 导出把 shim 指回自身）
[[ "${NAO_SHIM_ENTERED:-}" == "1" ]] && degrade "检测到 shim 递归调用（NAO_SHIM_ENTERED=1）"

command -v node >/dev/null 2>&1 || degrade "未找到 node（用于解析机制包根）"

# 在给定 node_modules 里找「含 nao 机制」的包（不硬编码包名）
# 输出：<包根>\t<已装版本>\t<settings pin 版本>（未命中则空）
resolve_nao_pkg() { # $1 = node_modules 目录
  node -e '
    (() => {
    const fs = require("fs"), path = require("path");
    const mod = process.argv[1], settings = process.argv[2];
    const names = [];
    try {
      const s = JSON.parse(fs.readFileSync(settings, "utf8"));
      for (const raw of (s.packages || [])) {
        const m = /^npm:(.+?)(?:@([^@/]+))?$/.exec(String(raw));
        if (!m) continue;
        let name = m[1], ver = m[2] || "";
        if (name.startsWith("@") && name.includes("/@")) {
          const i = name.indexOf("/@");
          ver = name.slice(i + 2);
          name = name.slice(0, i);
        }
        names.push([name, ver]);
      }
    } catch {}
    for (const [name, pin] of names) {
      let pj;
      try { pj = require.resolve(name + "/package.json", { paths: [mod] }); } catch { continue; }
      const root = path.dirname(pj);
      let installed = "";
      try { installed = JSON.parse(fs.readFileSync(pj, "utf8")).version || ""; } catch {}
      if (!fs.existsSync(path.join(root, ".agents", "scripts", "nao-fleet.sh"))) continue;
      process.stdout.write(root + "\t" + installed + "\t" + pin);
      return;
    }
    })();
  ' "$1" "$SETTINGS" 2>/dev/null || true
}

PKG_ROOT=""
PIN_VER=""

# 1) 显式 NAO_SKILLS
if [[ -n "${NAO_SKILLS:-}" ]]; then
  [[ -d "$NAO_SKILLS" ]] || degrade "NAO_SKILLS 不是目录：$NAO_SKILLS"
  PKG_ROOT="$(cd "$NAO_SKILLS" && pwd)"
  [[ -f "$PKG_ROOT/.agents/scripts/nao-fleet.sh" ]] || degrade "NAO_SKILLS 指向的不是 nao 机制包：$PKG_ROOT"
else
  # 2) 项目 .pi/npm（pin 主）
  FOUND="$(resolve_nao_pkg "$PROJ_ROOT/.pi/npm/node_modules")"
  # 3) ~/.pi/agent/npm（须版本与 pin 一致才采用）
  if [[ -z "$FOUND" ]]; then
    CAND="$(resolve_nao_pkg "$GLOBAL_MOD")"
    if [[ -n "$CAND" ]]; then
      c_inst="${CAND#*$'\t'}"; c_inst="${c_inst%%$'\t'*}"
      c_pin="${CAND##*$'\t'}"
      [[ -n "$c_pin" && "$c_inst" == "$c_pin" ]] && FOUND="$CAND"
    fi
  fi
  [[ -n "$FOUND" ]] || degrade "机制包未物化（.pi/npm 与 ~/.pi/agent/npm 均未找到含 .agents/scripts/nao-fleet.sh 的包）"

  PKG_ROOT="${FOUND%%$'\t'*}"
  REST="${FOUND#*$'\t'}"
  INSTALLED="${REST%%$'\t'*}"
  PIN_VER="${REST#*$'\t'}"
  if [[ -n "$PIN_VER" && -n "$INSTALLED" && "$INSTALLED" != "$PIN_VER" ]]; then
    degrade "机制包版本不符（pin=$PIN_VER，实得=$INSTALLED）"
  fi
fi

# D7②：包根 != shim 自身所属项目根
[[ "$PKG_ROOT" != "$PROJ_ROOT" ]] || degrade "解析出的包根与本项目根相同（$PKG_ROOT；shim 自指）"

TARGET="$PKG_ROOT/.agents/scripts/nao-fleet.sh"
[[ -f "$TARGET" ]] || degrade "机制包缺少 $TARGET"

# 进入包内真实脚本（置标记；NAO_SKILLS=机制包根）
export NAO_SHIM_ENTERED=1
export NAO_SKILLS="$PKG_ROOT"
exec bash "$TARGET" "$@"
