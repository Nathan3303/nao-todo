/**
 * 同步状态（可观测）
 * @description 供 UI 订阅展示：同步中/上次**成功**同步时间/待推送数/失败数/运行级错误聚合；
 *              内存态 + 订阅通知（见 data-sync-plan.md §8 Phase 3）。
 *              运行（run）边界：一次运行 = beginRun → noteRunError* → endRun；
 *              **仅 beginRun 清空错误、仅 endRun 落定状态**（阶段不得清写，见 SHELL-03 ADR D-2）。
 */

/** 同步阶段（错误归因；运行入口） */
export type SyncPhase = 'pull' | 'push'

/** 一次同步运行的结果（门/调用方据此判成败，替代读全局 lastError，见 ADR C-10/R4） */
export interface SyncRunResult {
    /** 本次运行是否无错误 */
    ok: boolean
    /** 本次运行累积错误（保序去重） */
    errors: string[]
    /** 按执行序首个错误（无错误为 null） */
    lastError: string | null
    /** 首个错误所属阶段（无错误为 null，见 ADR 附录 A-1） */
    phase: SyncPhase | null
}

export interface SyncStatusState {
    /** 是否正在同步（拉取或推送执行中） */
    syncing: boolean
    /** 上次成功同步完成时间（ISO；失败不推进，见 C-11） */
    lastSyncAt: string | null
    /** 待推送实体数（syncQueue 总量） */
    pendingCount: number
    /** 推送失败实体数（retryCount > 0，含超限暂停项） */
    failedCount: number
    /** 最近一次运行的按执行序首个错误信息 */
    lastError: string | null
    /** 最近一次运行的错误列表（保序去重） */
    errors: string[]
    /** 最近一次运行的错误数 */
    errorCount: number
}

export class SyncStatus {
    private state: SyncStatusState = {
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        lastError: null,
        errors: [],
        errorCount: 0
    }

    private listeners = new Set<() => void>()

    /** 本次运行累积错误（保序去重：阶段 + 文案 唯一） */
    private runErrors: { phase: SyncPhase; message: string }[] = []

    /** 获取当前状态快照（errors 为副本，防外部直改内部数组） */
    get(): SyncStatusState {
        return { ...this.state, errors: [...this.state.errors] }
    }

    /** 订阅状态变更（返回取消订阅函数） */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /** 内部更新 + 通知 */
    private set(partial: Partial<SyncStatusState>): void {
        this.state = { ...this.state, ...partial }
        for (const listener of this.listeners) listener()
    }

    /**
     * 运行开始：syncing=true；**仅此处**清空累积错误（R2）
     * @param _phase 运行入口阶段（ADR 契约参数；结果的 phase 以首个错误归属为准，故此处仅作文档语义）
     */
    beginRun(_phase: SyncPhase): void {
        this.runErrors = []
        this.set({ syncing: true, lastError: null, errors: [], errorCount: 0 })
    }

    /**
     * 阶段错误上报（R1：运行内不清空；Q3①：同阶段同文案只记一次）
     * @description 仅累积，不落定 —— 落定统一由 endRun 在运行边界完成
     */
    noteRunError(phase: SyncPhase, message: string): void {
        if (this.runErrors.some((e) => e.phase === phase && e.message === message)) return
        this.runErrors.push({ phase, message })
    }

    /**
     * 运行结束：落定 lastError/errors/errorCount、结束 syncing、刷新计数（R3/C-11）
     * @param counts 运行结束时刷新一次的待推送/失败计数（可选；无会话传 0）
     */
    endRun(counts?: { pendingCount: number; failedCount: number }): SyncRunResult {
        const first = this.runErrors[0]
        const errors = this.runErrors.map((e) => e.message)
        const lastError = first?.message ?? null
        const partial: Partial<SyncStatusState> = {
            syncing: false,
            lastError,
            errors,
            errorCount: errors.length,
            ...counts
        }
        // 仅无错误时推进「上次成功同步」（修正 DEF-SYNC-03）
        if (lastError === null) partial.lastSyncAt = new Date().toISOString()
        this.runErrors = []
        this.set(partial)
        return {
            ok: lastError === null,
            errors,
            lastError,
            phase: lastError === null ? null : (first?.phase ?? null)
        }
    }
}

/** 同步状态单例 */
export const syncStatus = new SyncStatus()