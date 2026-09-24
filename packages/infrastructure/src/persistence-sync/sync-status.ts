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
    /** 本次运行是否发生凭证类失败（10041 会话失效）；C-34：结构化判定，替代文案正则 */
    credentialFailure: boolean
    /**
     * 本次运行是否**真实进入拉取阶段**（T107c；纯追加、不落盘）
     * @description 供给「离线进入」只读闸门的**解除条件**判定：`start()` 在注销宽限期 / 无会话
     *              等路径**早退**时不经拉取，但 `ok`/`lastSyncAt` 仍为成功语义（空运行）
     *              ⇒ **不得用 `ok`/`lastSyncAt` 反推「真实同步过」**。
     */
    pullExecuted: boolean
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
    /**
     * 偏好队列推送失败数（TASK-26 / T136 GAP-2；AC3-04）
     * @description **独立于业务 `failedCount`**，不计入 `pendingCount`（PS-10）；
     *              仅由 `pushPreferenceQueue` 落定，供状态面/UI 展示。
     */
    preferenceFailedCount: number
    /**
     * 冲突记账条数（PS-14 / DP-1；独立字段）
     * @description **不计入**业务 `pendingCount`/`failedCount`（同 `preferenceFailedCount` 范式）；
     *              由 `conflict-journal` 写入后落定，供状态面可见「冲突 N」。
     */
    conflictCount: number
    /** 最近一次运行的按执行序首个错误信息 */
    lastError: string | null
    /** 最近一次运行的错误列表（保序去重） */
    errors: string[]
    /** 最近一次运行的错误数 */
    errorCount: number
    /** 最近一次运行是否发生凭证类失败（10041）；纯追加字段（C-34） */
    credentialFailure: boolean
    /** 是否处于待同步暂停态（SHELL-06 C-41；离线/超限） */
    paused: boolean
    /** 暂停原因（可选） */
    pausedReason?: 'offline' | 'over-limit'
    /**
     * 镜像完整拉取时间（DEF-6 / AC13b / C-60）
     * @description 仅当一次拉取**所有表均取尽**（未触发续拉上界）时推进；
     *              截断/失败**不得推进**（不得谎报完整度）⇒ 供 C-60 文案③「尚未同步完成」判定
     */
    mirrorPulledAt: string | null
    /** 镜像是否因续拉上界被截断（触顶提示；下次完整取尽时清除） */
    mirrorTruncated: boolean
}

export class SyncStatus {
    private state: SyncStatusState = {
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        lastError: null,
        errors: [],
        errorCount: 0,
        credentialFailure: false,
        paused: false,
        mirrorPulledAt: null,
        mirrorTruncated: false
    }

    private listeners = new Set<() => void>()

    /** 本次运行累积错误（保序去重：阶段 + 文案 唯一） */
    private runErrors: { phase: SyncPhase; message: string }[] = []

    /** 本次运行是否发生凭证类失败（10041）；运行边界重置（C-34） */
    private runCredentialFailure = false

    /** 本次运行是否真实进入拉取阶段（T107c）；运行边界重置，不回填历史 */
    private runPullExecuted = false

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
        this.runCredentialFailure = false
        this.runPullExecuted = false
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
     * 标记本次运行发生凭证类失败（10041 会话失效）
     * @description C-34：由同步服务在识别 10041 时调用；运行内累积，endRun 落定
     */
    markCredentialFailure(): void {
        this.runCredentialFailure = true
    }

    /**
     * 标记本次运行真实进入拉取阶段（T107c）
     * @description 仅由同步服务在**真正执行拉取**处调用；仅置运行内字段，**不落定、不通知订阅**
     *              （避免无意义的重渲染/持久化副作用，C-59）；早退路径无需显式清除。
     */
    markPullExecuted(): void {
        this.runPullExecuted = true
    }

    /**
     * 落定偏好队列推送结果（TASK-26 / T136 GAP-2；AC3-04）
     * @description 独立字段：不改变业务 `pendingCount`/`failedCount` 语义（PS-10），
     *              也**不参与** `beginRun`/`endRun` 运行边界。
     */
    reportPreferencePush(result: { pushed: number; failed: number }): void {
        this.set({ preferenceFailedCount: result.failed })
    }

    /**
     * 落定冲突记账条数（PS-14 / DP-1）
     * @description 独立字段：不改变业务 `pendingCount`/`failedCount` 语义，
     *              也**不参与** `beginRun`/`endRun` 运行边界（同 `preferenceFailedCount`）。
     */
    setConflictCount(count: number): void {
        this.set({ conflictCount: count })
    }

    /**
     * 标记暂停（离线/超限）；跨运行状态，beginRun/endRun 不改动（C-45）
     */
    setPaused(reason: 'offline' | 'over-limit'): void {
        this.set({ paused: true, pausedReason: reason })
    }

    /** 清除暂停态（恢复回传/触顶恢复） */
    clearPaused(): void {
        this.set({ paused: false, pausedReason: undefined })
    }

    /**
     * 标记镜像完整拉取（所有表取尽）：推进 `mirrorPulledAt` 并清除触顶提示
     * @description DEF-6 / AC13b：仅完整拉取可推进，截断不得谎报完整度
     */
    markMirrorPulled(): void {
        this.set({ mirrorPulledAt: new Date().toISOString(), mirrorTruncated: false })
    }

    /**
     * 标记镜像拉取被续拉上界截断：**不推进** `mirrorPulledAt`，置触顶提示
     * @description DEF-6 / AC13b 护栏 B
     */
    markMirrorTruncated(): void {
        this.set({ mirrorTruncated: true })
    }

    /**
     * 从持久化存储恢复镜像新鲜度（冷启动离线；T107b）
     * @description `null` 仅在「确实从未成功拉取过」时出现（C-60③ / AC9）；
     *              用户切换时以磁盘事实覆盖内存旧值。
     */
    restoreMirrorStatus(status: { mirrorPulledAt: string | null; mirrorTruncated: boolean }): void {
        this.set({ mirrorPulledAt: status.mirrorPulledAt, mirrorTruncated: status.mirrorTruncated })
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
            credentialFailure: this.runCredentialFailure,
            ...counts
        }
        // 仅无错误时推进「上次成功同步」（修正 DEF-SYNC-03）
        if (lastError === null) partial.lastSyncAt = new Date().toISOString()
        const credentialFailure = this.runCredentialFailure
        const pullExecuted = this.runPullExecuted
        this.runErrors = []
        this.runCredentialFailure = false
        this.runPullExecuted = false
        this.set(partial)
        return {
            ok: lastError === null,
            errors,
            lastError,
            phase: lastError === null ? null : (first?.phase ?? null),
            credentialFailure,
            pullExecuted
        }
    }
}

/** 同步状态单例 */
export const syncStatus = new SyncStatus()