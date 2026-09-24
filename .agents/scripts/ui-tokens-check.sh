#!/usr/bin/env bash
# =============================================================================
# ui-tokens-check.sh — 扫描 UI 硬编码颜色值（绕过 Design Tokens）
#
# 用法
#   ui-tokens-check.sh [<repo>] [-x <额外排除模式>]
#     默认 $PWD；退出码 0=通过 1=存在违规
#
# 原理
#   UI 视觉应收敛到 Design Tokens（tokens.css 的 --<prefix>-* 变量）。
#   组件内裸色值（#fff / rgba() / #d4a72c）会破坏换主题/暗色模式并造成
#   风格漂移。本脚本扫出这些绕过令牌的色值，供交付前自查或接 CI/lint-staged。
#
# 排除（默认）
#   node_modules / .codegraph / .d.ts
#   令牌定义文件：tokens.css / theme.css / variables.css（-x 追加自定义）
#   任意 CSS 变量定义行（--xxx: <值>）
#
# 非代码内容（测试断言里的期望色值）命中后由人/agent 判断是否豁免。
# =============================================================================
set -uo pipefail

repo="$PWD"; extra=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -x) extra="${2:-}"; shift 2 ;;
    *)  repo="$1"; shift ;;
  esac
done

cd "$repo" 2>/dev/null || { echo "✗ 目录不存在: $repo" >&2; exit 2; }

file_excl="node_modules|\.codegraph|\.d\.ts|tokens\.css|theme\.css|variables\.css"
[[ -n "$extra" ]] && file_excl+="|$extra"

hits="$(grep -rnoE --include='*.vue' --include='*.ts' --include='*.tsx' \
        --include='*.js' --include='*.jsx' --include='*.css' \
        -E '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' . 2>/dev/null \
      | grep -vE "$file_excl" \
      | grep -viE -- 'var\(--|--[a-z0-9-]+[[:space:]]*:[[:space:]]*(#|rgba?\(|hsla?\()' \
      | head -40 || true)"

if [[ -n "$hits" ]]; then
  echo "✗ UI 令牌违规（$(basename "$repo")）— 以下色值应改为 var(--<prefix>-*) 令牌："
  echo "$hits"
  if [[ $(grep -c . <<< "$hits") -ge 40 ]]; then echo "  …（更多）"; fi
  exit 1
fi

echo "✓ $(basename "$repo") 无硬编码色值（Design Tokens 一致）"
exit 0
