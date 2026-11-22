/**
 * 更新状态机（设计稿 §5 九态 · 单一可订阅）
 *
 * @description 全应用**只有一个**更新状态源：主进程内核持有它，preload 订阅后推给渲染层。
 *              渲染层不再自己推导状态组合（状态爆炸与双源抖动都由本机集中排除）。
 *              三条硬规则：
 *              ① **`ready` 不可被检查结果覆盖**（P5：已下载成果不能被一次检查抹掉）；
 *              ② `failed` 之后必须能再次进入检查/下载（AC11：按钮不得永久禁用）；
 *              ③ **`unsupported` 是前置 gate**（AC4b）：它是形态判定阶段的初始态、不参与
 *                 `checking` / `available` 流转 ⇒ 出向白名单为空（无迁移可出）。
 * @see docs/designs/358-desktop-self-update.md（§5 状态 / 优先级）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1 / AC4b / AC6 / AC11）
 */
import type { DesktopUpdateState, DesktopUpdateStatus } from '@nao-todo/shared'

/** 合法迁移表（`from → to` 白名单；同态自迁移恒允许，用于进度/字段刷新） */
const ALLOWED_TRANSITIONS: Record<DesktopUpdateState, readonly DesktopUpdateState[]> = {
    // 前置 gate：形态不支持应用内更新 ⇒ 独占终态（⛔ 永不进 checking / available）
    unsupported: [],
    idle: ['checking'],
    checking: ['available', 'up-to-date', 'failed'],
    // available 期允许再检查（手动重查），也允许开始下载
    available: ['downloading', 'checking', 'failed'],
    downloading: ['ready', 'failed'],
    // ready 只允许「安装失败」一种迁移；检查/下载结果一律拒绝（P5）
    ready: ['failed'],
    'up-to-date': ['checking'],
    'just-updated': ['checking'],
    failed: ['checking', 'downloading', 'ready']
}

/** 该迁移是否被允许（导出仅供用例直接断言迁移表） */
export const canTransition = (from: DesktopUpdateState, to: DesktopUpdateState): boolean =>
    from === to || ALLOWED_TRANSITIONS[from].includes(to)

export type UpdateStatusListener = (status: DesktopUpdateStatus) => void

export interface UpdateStateMachine {
    /** 当前状态（只读快照，调用方不得原地修改） */
    get(): DesktopUpdateStatus
    /**
     * 提交新状态
     * @returns 生效后的状态；被迁移表拒绝时返回**当前**状态（调用方可据此判断是否生效）
     */
    set(next: DesktopUpdateStatus): DesktopUpdateStatus
    /** 订阅状态变化（返回取消订阅） */
    subscribe(listener: UpdateStatusListener): () => void
}

/**
 * 创建状态机
 * @param initial 初始状态（由内核按缓存 + 当前版本推导）
 */
export const createUpdateStateMachine = (initial: DesktopUpdateStatus): UpdateStateMachine => {
    let current: DesktopUpdateStatus = initial
    const listeners = new Set<UpdateStatusListener>()

    return {
        get: () => current,
        set: (next) => {
            if (!canTransition(current.state, next.state)) return current
            current = next
            // 逐个通知：单个订阅者抛错不得阻断其它订阅者（preload 推播 / 本地日志）
            for (const listener of listeners) {
                try {
                    listener(current)
                } catch {
                    /* 订阅者自身异常：不得影响状态机与主进程其它能力 */
                }
            }
            return current
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        }
    }
}