/**
 * 门禁 pathspec 存在性守卫
 * @description 防「门禁命令里的 pathspec 不存在 ⇒ git 对不存在 pathspec 静默忽略 ⇒
 * 门禁恒为 0（空转）」这一类验收口径漏洞（本项目曾把 apps/mobile 误写为 apps/mobileapp）。
 *  1. 解析 AGENTS.md「全范围门禁」条目内的 `git status ... -- <pathspec...>` 命令，
 *     断言每个 pathspec（含 glob 的静态前缀）在仓库中确实存在；
 *  2. 同样扫描 .agents/**\/*.md（角色卡 / 核对清单 / 公共规范）中的同类命令；
 *  3. 若「全范围门禁」条目内找不到任何 git status 命令 ⇒ 显式失败（避免守卫本身空转）。
 * 用途：CI / 提交前手动跑 `pnpm guard:gate-pathspec`。
 * 说明：文档中如确需引用「错误示例」，请在该行加入 `<!-- gate-pathspec:ignore -->` 跳过。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GATE_MARKER = '全范围门禁'
const IGNORE_MARKER = 'gate-pathspec:ignore'
const GIT_STATUS = /\bgit\s+status\b/
const LIST_OR_HEADING = /^\s*(?:[-*]|\d+\.|#{1,6}|>)\s/

const offenders = []
const seen = new Set()

/** 从 markdown 行中取出全部行内代码（`...`）片段 */
const extractInlineCode = (line) => {
    const spans = []
    const re = /`([^`\n]+)`/g
    let m
    while ((m = re.exec(line)) !== null) spans.push(m[1])
    return spans
}

/** 取命令 `--` 之后的 tokens 作为 pathspec；无 `--` 视为全仓（无需校验） */
const pathspecsOf = (command) => {
    const tokens = command.trim().split(/\s+/)
    const sep = tokens.indexOf('--')
    return sep === -1 ? [] : tokens.slice(sep + 1).filter((t) => t.length > 0)
}

/** glob pathspec 只校验其静态前缀目录（如 packages/* → packages） */
const staticPrefix = (token) => {
    const idx = token.search(/[*?[{]/)
    if (idx === -1) return token
    const prefix = token.slice(0, idx)
    const slash = prefix.lastIndexOf('/')
    return slash === -1 ? '.' : prefix.slice(0, slash)
}

const record = (where, token) => {
    const key = `${where}::${token}`
    if (seen.has(key)) return
    seen.add(key)
    offenders.push(`${where}: pathspec 不存在 → ${token}`)
}

const checkCommand = (command, where) => {
    if (!GIT_STATUS.test(command)) return
    for (const token of pathspecsOf(command)) {
        if (token.startsWith('-')) continue
        if (!existsSync(resolve(ROOT, staticPrefix(token)))) record(where, token)
    }
}

/** 截取「全范围门禁」条目（可跨行续行）的文本行 */
const gateSectionLines = (text) => {
    const lines = text.split(/\r?\n/)
    const out = []
    let capturing = false
    for (const line of lines) {
        if (line.includes(GATE_MARKER)) {
            capturing = true
            out.push(line)
            continue
        }
        if (!capturing) continue
        if (line.trim() === '' || LIST_OR_HEADING.test(line)) {
            capturing = false
            continue
        }
        out.push(line)
    }
    return out
}

/** 扫描 AGENTS.md 的「全范围门禁」条目（门禁口径的单一事实来源） */
const scanAgentsGate = () => {
    const where = `AGENTS.md[${GATE_MARKER}]`
    const text = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
    let commands = 0
    for (const line of gateSectionLines(text)) {
        if (line.includes(IGNORE_MARKER)) continue
        for (const span of extractInlineCode(line)) {
            if (!GIT_STATUS.test(span)) continue
            commands += 1
            checkCommand(span, where)
        }
    }
    if (commands === 0) offenders.push(`${where}: 未找到 git status 门禁命令（守卫会空转，拒绝）`)
}

/** 扫描 .agents/**\/*.md 中的同类门禁命令（角色卡 / 清单 / 公共规范） */
const scanAgentsDocs = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (entry === '.nao-obsolete') continue
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) {
            scanAgentsDocs(p)
            continue
        }
        if (!entry.endsWith('.md')) continue
        const text = readFileSync(p, 'utf8')
        text.split(/\r?\n/).forEach((line) => {
            if (line.includes(IGNORE_MARKER)) return
            for (const span of extractInlineCode(line)) checkCommand(span, relative(ROOT, p))
        })
    }
}

const agentsDir = join(ROOT, '.agents')
scanAgentsGate()
if (existsSync(agentsDir)) scanAgentsDocs(agentsDir)

if (offenders.length > 0) {
    console.error('[guard:gate-pathspec] 门禁 pathspec 校验失败：')
    offenders.forEach((line) => console.error('  - ' + line))
    process.exit(1)
}
console.log('[guard:gate-pathspec] OK - 门禁命令 pathspec 均存在')