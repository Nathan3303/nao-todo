/**
 * web 首拉门（PS-16）
 * @description web 无 desktop 的 `InitialSyncGate`；业务读路径切本地后「本地空 ⇒ 首屏空」。
 *              本模块提供**基于本地镜像存在性**（`hasLocalMirror`）的首拉门判定：
 *              - `hasLocalMirror` 为真 ⇒ 立即本地优先（放行）；
 *              - 为假且在线 ⇒ **等待首次拉取完成或超时放行**（超时后由 C-60③ 状态面显示
 *                「尚未同步完成」文案）；
 *              - 为假且离线 ⇒ 放行（既有「离线进入」引导，原因码 `mirror-missing`，不新增拦截）；
 *              - 未登录（`/auth` 页）⇒ 放行。
 *              ⛔ **禁**以「单次读返回空」推断无数据（合法的空清单）；只以镜像存在性判据。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（PS-16）
 */
import { resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { getFirstPullSettled, startWebDataPlane } from '@/data-plane'
import { hasLocalMirror } from './offline-prerequisites'

/** 首拉门等待上限（ms）：超时放行并显示「尚未同步完成」（PS-16 / C-60③） */
export const FIRST_PULL_GATE_TIMEOUT_MS = 10_000

/** 首拉门终态：`pass` 放行；`wait` 需等待；`released` 超时放行（状态面提示未同步完成） */
export type FirstPullGateState = 'pass' | 'wait' | 'released'

export interface FirstPullGateInput {
    /** 是否有可解析的登录用户（无 ⇒ 认证页，不拦） */
    hasUserId: boolean
    /** 本地镜像存在（`hasLocalMirror`） */
    hasLocalMirror: boolean
    /** 是否在线（`navigator.onLine !== false`） */
    online: boolean
    /** 首次拉取是否已落定（成功或失败） */
    pullSettled: boolean
    /** 是否已超时 */
    timedOut: boolean
}

/**
 * 纯判定（可单测）：本地空 + 在线 + 首拉未落定 ⇒ `wait`（超时 ⇒ `released`）
 * @description 判定顺序即 PS-16 规则顺序；**只以镜像存在性/首拉信号为判据**。
 */
export const evaluateFirstPullGate = (input: FirstPullGateInput): FirstPullGateState => {
    if (!input.hasUserId) return 'pass'
    if (input.hasLocalMirror) return 'pass'
    if (!input.online) return 'pass'
    if (input.pullSettled) return 'pass'
    return input.timedOut ? 'released' : 'wait'
}

/** 等待 `promise` 落定或超时；返回是否超时（promise 拒绝亦视为已落定） */
const raceTimeout = (promise: Promise<void>, ms: number): Promise<boolean> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(true), ms)
        const done = (): void => {
            clearTimeout(timer)
            resolve(false)
        }
        promise.then(done, done)
    })

/**
 * 执行首拉门判定（接线真实依赖；等待期由 `onWait` 通知调用方显示加载态）
 * @param options.timeoutMs 等待上限（默认 `FIRST_PULL_GATE_TIMEOUT_MS`；测试可注入小值）
 * @param options.onWait 仅当确实进入等待时调用一次（避免「立即放行」路径闪一下加载态）
 * @returns 终态（`pass` / `released`；不会返回 `wait` —— 等待已在内部收敛）
 */
export const waitForFirstPullGate = async (
    options: { timeoutMs?: number; onWait?: () => void } = {}
): Promise<FirstPullGateState> => {
    const userId = resolveUserIdFromStoredJwt()
    const hasUserId = userId !== null
    const mirror = hasUserId ? await hasLocalMirror(userId) : false
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
    const base: FirstPullGateInput = {
        hasUserId,
        hasLocalMirror: mirror,
        online,
        pullSettled: false,
        timedOut: false
    }
    if (evaluateFirstPullGate(base) === 'pass') return 'pass'
    // 本地空 + 在线：进入等待（触发/复用首次拉取）
    options.onWait?.()
    startWebDataPlane()
    const settled = getFirstPullSettled()
    if (!settled) {
        // 拉取未启动（异常防御）：按超时放行语义处理，不永久阻塞
        return evaluateFirstPullGate({ ...base, timedOut: true })
    }
    const timedOut = await raceTimeout(settled, options.timeoutMs ?? FIRST_PULL_GATE_TIMEOUT_MS)
    return evaluateFirstPullGate({ ...base, pullSettled: !timedOut, timedOut })
}