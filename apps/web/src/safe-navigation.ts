/**
 * 安全导航工具（SHELL-05 T4 / C-28 / C-30；T6 / C-35）
 * @description 纯函数工具：路由候选目标的合法化校验 + 失效键清理 + section 重定向决策 +
 *              统一导航封装（safeReplace / safeReplaceDeepLink）。
 *              判据：`router.resolve(target).matched.length > 0` 且 `fullPath` 不以 `/auth` 开头。
 *              统一失败处理：不静默（走 error-observability）、不卡死（不抛错冒泡）。
 */
import { NavigationFailureType } from 'vue-router'
import { delay } from '@nao-todo/shared/requester/retry'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { recordShellError } from './error-observability'

/** 仅需 resolve/replace 的 router 视图（避免直接依赖具体 Router 类型） */
export type SafeNavigationRouter = {
    resolve: (target: string) => { matched: unknown[]; fullPath: string }
    replace: (target: string) => Promise<unknown>
}

/** localStorage 最小接口（清理失效键） */
export type NavigationStorage = Pick<Storage, 'removeItem'>

/** 导航候选：value 来自 storage 时带 key，非法则清理该键 */
export type NavigationCandidate = {
    key?: string
    value?: string | null
}

/** 校验并归一化单个目标；非法返回 null（resolve 抛错也视为非法） */
export const resolveNavigableTarget = (
    router: SafeNavigationRouter,
    target: string | null | undefined
): string | null => {
    if (!target) return null
    try {
        const resolved = router.resolve(target)
        if (resolved.matched.length === 0) return null
        if (resolved.fullPath.startsWith('/auth')) return null
        return resolved.fullPath
    } catch {
        return null
    }
}

/**
 * 候选链取首个合法目标（回退链）
 * @description 顺序校验 candidates；非法且有 key 的候选会从 storage 移除（防下次再撞）；
 *              router 不可用时不做清理，直接返回 fallback（避免误删用户数据）。
 */
export const pickSafeNavigationTarget = (
    router: SafeNavigationRouter | undefined,
    candidates: readonly NavigationCandidate[],
    fallback: string,
    storage?: NavigationStorage
): string => {
    if (!router) return fallback
    for (const candidate of candidates) {
        if (!candidate.value) continue
        const resolved = resolveNavigableTarget(router, candidate.value)
        if (resolved) return resolved
        if (candidate.key) {
            // 清理失效键；存储不可用（隐私模式/配额）不阻断回退
            try {
                storage?.removeItem(candidate.key)
            } catch {
                /* ignore：清理失败不影响导航 */
            }
        }
    }
    return fallback
}

/**
 * section 重定向决策（router.beforeEach 用）
 * @returns target=需重定向的合法目标（null=放行）；cleanup=是否清理失效键
 */
export const resolveSectionRedirect = (
    router: SafeNavigationRouter,
    savedRoute: string | null | undefined,
    toFullPath: string
): { target: string | null; cleanup: boolean } => {
    if (!savedRoute) return { target: null, cleanup: false }
    if (savedRoute === toFullPath) return { target: null, cleanup: false }
    const resolved = resolveNavigableTarget(router, savedRoute)
    // 失效字符串：清理并放行（禁把失效字符串当重定向目标）
    if (!resolved) return { target: null, cleanup: true }
    // 与当前目标等价：放行，避免循环
    if (resolved === toFullPath) return { target: null, cleanup: false }
    return { target: resolved, cleanup: false }
}

/* —— C-35：统一导航封装（门/壳/auth 页收敛入口） —— */

/** 导航失败提示（P1 / Issue #260 修复④：登录后导航失败不得静默） */
const NAVIGATION_RETRY_DELAY_MS = 250

/** 可重试判定：除 `duplicated`（目标即当前路由，常态 no-op）外一律可重试 ——
   aborted / cancelled / 守卫抛错或 chunk 加载失败的原始 Error 都应给用户反馈 */
const isRetryableFailure = (failure: unknown): boolean =>
    (failure as { type?: unknown } | null)?.type !== NavigationFailureType.duplicated

/** 用户可见的导航失败反馈（一次/次失败；测试可 mock nue-ui） */
const notifyNavigationFailed = (): void => {
    NueMessage.error(t('common.navigationFailed'))
}

/**
 * 统一 `router.replace` 封装：router 不可用/导航失败均结构化记录，**绝不抛错**
 * @param source 结构化日志来源（稳定字符串）
 * @description **失败可⻅（#260 修复④）**：vue-router 4 在守卫中止/重定向时**不 reject**，
 *              而是 resolve 一个 `NavigationFailure` ⇒ 旧实现既不 catch 也不看返回值 ⇒
 *              「登录成功但界面不动」无任何反馈。现在：失败 ⇒ 用户可见提示 + **一次**自动重试
 *              （重试再败仍只提示，不循环）；`duplicated`（目标就是当前路由，如重复 replace('/auth/signin')）
 *              仅记录不提示（不是用户可感的失败）。
 */
export const safeReplace = async (
    router: SafeNavigationRouter | undefined,
    to: string,
    source: string
): Promise<void> => {
    if (!router) {
        recordShellError(source, `router 不可用，导航中止：${to}`)
        return
    }
    /** 单次尝试：reject 也归一为 failure（不外抛） */
    const attempt = async (): Promise<unknown> => {
        try {
            const failure = await router.replace(to)
            return failure ?? null
        } catch (error) {
            return error
        }
    }
    const first = await attempt()
    if (first === null) return
    recordShellError(source, first)
    // duplicated = 目标即当前路由（登出/失效导航的常态 no-op）⇒ 静默，不算用户可感失败
    if (!isRetryableFailure(first)) return
    notifyNavigationFailed()
    await delay(NAVIGATION_RETRY_DELAY_MS)
    const second = await attempt()
    if (second === null) return
    recordShellError(source, second)
    notifyNavigationFailed()
}

/**
 * 深链回退链 + 安全导航：候选链取首个合法目标（失效键清理）后 replace
 * @description 收敛 `localStorage.getItem(...) || '/tasks'` 类裸导航（C-35/B-13）。
 */
export const safeReplaceDeepLink = async (
    router: SafeNavigationRouter | undefined,
    candidates: readonly NavigationCandidate[],
    fallback: string,
    source: string,
    storage?: NavigationStorage
): Promise<void> => {
    const target = pickSafeNavigationTarget(router, candidates, fallback, storage)
    await safeReplace(router, target, source)
}