/**
 * 红基线「缺实现」装载器（T575 / AC1–AC12）
 *
 * @description 用例先行阶段被测模块**尚不存在**：静态 `import` 会让整个测试文件在收集期解析失败，
 *              一条用例也跑不到，失败原因也无法指向具体 AC。因此用**变量说明符**动态 `import`：
 *              ① 模块缺失 ⇒ 每个用例各自抛出 `UnableToImplementError`（说明期望文件 + 期望导出 + AC）；
 *              ② 模块存在但缺导出 ⇒ 同上，指名缺哪个导出；
 *              ③ 实现落地后，本装载器自动退化为普通 import 语义，用例开始断言真实行为。
 *              说明符相对**本文件**（`utils/__tests__/`）解析。
 * @see docs/qa/2026-10-29-T575-test-contracts.md（用例契约：模块落点 / 导出名 / 语义）
 * @see apps/desktop/src/main/__tests__/impl-seam.ts（T544 同款装载器）
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
        // 说明符为变量 ⇒ Vite/TS 不做静态解析，模块缺失时落到 catch
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