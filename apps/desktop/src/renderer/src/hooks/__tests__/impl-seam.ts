/**
 * 红基线「缺实现」装载器（T575 / AC7–AC8 · 桌面渲染层）
 *
 * @description 用例先行阶段被测模块**尚不存在**：静态 `import` 会让整个测试文件在收集期解析失败。
 *              用**变量说明符**动态 `import` ⇒ 模块缺失 / 缺导出时每个用例各自抛出可读的
 *              `UnableToImplementError`（期望落点 + 期望导出 + AC）；实现落地后自动退化为普通 import 语义。
 *              说明符相对**本文件**（`renderer/src/hooks/__tests__/`）解析。
 * @see docs/qa/2026-10-29-T575-test-contracts.md（§4 托盘 tooltip / AC7·AC8）
 * @see docs/reports/T574-arch-review.md（§五 第 6 条 hook 落点 / §四 失败降级）
 */

/** 期望的模块导出面缺失（失败原因 = 缺实现，不是用例写错） */
export class UnableToImplementError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UnableToImplementError'
    }
}

/**
 * 装载待实现模块
 * @param specifier 相对本文件的说明符（必须用变量传入，避免静态解析）
 * @param modulePath 期望的实现落点（错误信息里给人看）
 * @param exported 期望的导出名
 * @param ac 该用例对应的 AC / 技术指标
 */
export const loadImpl = async <T extends object>(
    specifier: string,
    modulePath: string,
    exported: readonly string[],
    ac: string
): Promise<T> => {
    let mod: Record<string, unknown>
    try {
        mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>
    } catch (error) {
        throw new UnableToImplementError(
            `[缺实现] 期望模块 ${modulePath}（${ac}）；当前：${(error as Error).message}`
        )
    }
    const missing = exported.filter((name) => typeof mod[name] === 'undefined')
    if (missing.length > 0) {
        throw new UnableToImplementError(
            `[缺实现] ${modulePath} 缺少导出：${missing.join('、')}（${ac}）`
        )
    }
    return mod as T
}