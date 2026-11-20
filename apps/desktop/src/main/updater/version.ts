/**
 * 版本比较（AC6 判定表 · PRD §五「版本比较」）
 *
 * @description 只做 SemVer **三段数字**比较（PRD 明确口径，不引第三方 semver：
 *              远端 tag 形如 `v1.21.0`、代表 prerelease 的未来需求不在本期）。
 *              非法/缺字段一律返回 `null`（**无法比较 ≠ 有新版本**），
 *              调用点必须显式处理 ⇒ 绝不把「解析失败」当成「有更新」。
 * @see docs/prds/2026-11-20-desktop-self-update.md（§五 / AC6）
 */

export interface ParsedVersion {
    major: number
    minor: number
    patch: number
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/i

/**
 * 解析版本号（容忍前缀 `v` / `V`；⛔ 不解析 prerelease、build 元数据）
 * @param raw 原始版本串（如 `1.21.0` / `v1.21.0`）
 * @returns 三段数字；无法解析 ⇒ `null`
 */
export const parseVersion = (raw: unknown): ParsedVersion | null => {
    if (typeof raw !== 'string') return null
    const matched = VERSION_PATTERN.exec(raw.trim())
    if (!matched) return null
    return {
        major: Number(matched[1]),
        minor: Number(matched[2]),
        patch: Number(matched[3])
    }
}

/**
 * 三段比较
 * @returns 正数 = `a` 更新；0 = 相等；负数 = `b` 更新；`null` = 任一侧无法解析
 */
export const compareVersions = (a: string, b: string): number | null => {
    const left = parseVersion(a)
    const right = parseVersion(b)
    if (!left || !right) return null
    return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

/**
 * 远端版本是否**严格大于**当前版本（AC6：相等不得提示有更新）
 * @description 任一侧解析失败 ⇒ `false`（保守：不提示有更新，失败由检查侧兜底）
 */
export const isNewerVersion = (candidate: string, current: string): boolean => {
    const compared = compareVersions(candidate, current)
    return compared !== null && compared > 0
}