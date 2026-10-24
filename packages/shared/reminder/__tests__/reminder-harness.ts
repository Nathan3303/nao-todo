/**
 * T525 · 提醒本地轮询：用例共用拍档 + **接缝契约**（用例即契约，RD 按此实现）
 *
 * 契约来源：PRD `docs/prds/2026-10-23-reminder-local-polling.md` §七 AC1–AC11 ·
 *           ADR `docs/adr/2026-10-23-reminder-local-judgment.md`（决策 2/3）·
 *           报告 `docs/reports/T526-arch-review.md` §3（落点与端口）§5（Q3–Q5 裁示）。
 *
 * ── 期望导出（`packages/shared/reminder/index.ts`）────────────────────────────
 *
 * 1) `REMINDER_SCAN_INTERVAL_MS: number` —— 轮询基准间隔 = 10_000（NFR「单一常量」）。
 *
 * 2) `collectDueReminders(tasks, now, isClaimed)` —— **纯核心**，无副作用。
 *    · `tasks: readonly ReminderTask[]` 本机候选（**未过滤**活跃态，由本函数过滤）
 *    · `now: number` 本机（校准后）毫秒时间戳
 *    · `isClaimed: (key: string) => boolean` **读侧**谓词：该键已落账 ⇒ true
 *      （PRD 记作 `claim`；写侧落账在引擎端口 `ledger.claim` —— 读侧保持纯函数可表驱动）
 *    · 返回 `readonly DueReminder[]`（`{ task, key }`，`key = \`${taskId}@${remindAt}\``），
 *      **按 remindAt 升序**，同刻保持入参顺序（稳定）
 *    · 过滤：`deletedAt` / `archivedAt` / `givenUpAt` 非空、`state === 'done'`、`remindAt`
 *      缺失或非法、已落账 ⇒ 排除；**不过滤子任务**（parentTaskId 非空照常）
 *    · 边界：`remindAt <= now` 即到期（闭区间）；时间字符串必须**解析后比较**（RFC3339 可能带偏移）
 *
 * 3) `nextOccurrence(task, firedAt)` —— 续期（镜像服务端 `calculateNextRemindAt` 语义）。
 *    · `firedAt: number | string | Date` 本次触发时刻
 *    · 返回 `string | null`：下一次 `remindAt` 的 ISO 串；`null` = 停止重复
 *      （`remindRepeat` 为空/`none`、next 越过 `endAt`）
 *    · daily 用 `remindTime`；weekly 用 `remindWeekdays` 位掩码（bit0=周日 … bit6=周六）；
 *      monthly 仅历史数据（下月同日同时刻）
 *
 * 4) `createClaimLedger({ storage })` —— 去重账本（键 `taskId@remindAt`）。
 *    · `claim(key): boolean` **同步**、幂等、原子：true = 本次抢到（首次）
 *    · `has(key): boolean`
 *    · `storage` 为 `Storage` 形状；**不可用**（缺省 / 抛错 / 配额满）⇒ 退化为**内存账本**，
 *      不抛错（AC6；跨标签/刷新唯一性降级为同标签内，登记已知限制）
 *
 * 5) `createReminderEngine(deps)` —— 引擎工厂（调度 / 可见性 / 落账 / 消费）。
 *    ```ts
 *    type ReminderEngineDeps = {
 *        listCandidates(): Promise<readonly ReminderTask[]>   // 本机候选；失败 ⇒ reject
 *        now(): number                                        // 校准后毫秒
 *        ledger: { claim(key: string): boolean }               // 展示**前**落账
 *        notify(event: TaskReminderEvent): void | Promise<void> // 应用内弹窗 + 系统通知（适配层）
 *        consume?(taskId: string, nextRemindAt: string | null): void | Promise<void> // 展示**后**消费
 *        requestNotificationPermission?(): void | Promise<unknown> // start 时**仅调一次**
 *    }
 *    // 返回 { start(): void; stop(): void; rescan(): Promise<void> }
 *    ```
 *    · `start()` 立即首轮扫描（**冷启动补弹**），仅可见时起 10s 轮询，并对最近一条未来提醒设精确定时
 *    · `stop()` 停轮询与定时；`rescan()` 立即一轮（可 await，供装配层「数据变更 / 回前台」触发）
 *    · 顺序硬约束：**先 `ledger.claim` → 再 `notify` → 再 `consume`**（AC3/AC4/R6）
 *    · `listCandidates` 失败 ⇒ 静默（不落账、不 notify、不抛未处理拒绝），下轮恢复即可补
 *
 * 事件类型：`TaskReminderEvent = {
 *     taskId: string; taskName: string; description?: string;
 *     projectId: string;   // T531/AC8：清单名由装配层按 projectId 注入解析
 *     remindAt: string;    // T531/AC8：**本次触发时刻**（非推进后的值）
 * }`（原 `shared/types/sse.ts` 的 `SSEReminderEvent` 迁移而来，AC10；T531 扩两字段）
 *
 * 注：本文件不是测试文件（无 `.test.` 后缀），仅供用例共享；**禁止**在本目录引入
 * `persistence-local` / `persistence-sync`（移动端红线 + DDD 守卫）。
 */
import type { ReminderTask } from '@nao-todo/shared/reminder'

/** 任务壳：用例只填关心的字段，其余给「活跃 + 无提醒」默认值 */
export const makeTask = (patch: Partial<ReminderTask> & { id: string }): ReminderTask => ({
    name: `任务-${patch.id}`,
    projectId: `p-${patch.id}`,
    description: undefined,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: null,
    endAt: null,
    state: 'todo',
    deletedAt: null,
    archivedAt: null,
    givenUpAt: null,
    parentTaskId: null,
    ...patch
})

/** `Storage` 形状的假存储：可模拟「不可用 / 配额满」 */
export class FakeStorage {
    private readonly map = new Map<string, string>()
    /** 读/写全抛（模拟隐私模式 / 无存储权限） */
    failAll = false
    /** 仅写抛（模拟配额不足） */
    failOnSet = false

    getItem(key: string): string | null {
        if (this.failAll) throw new Error('storage unavailable')
        return this.map.get(key) ?? null
    }

    setItem(key: string, value: string): void {
        if (this.failAll || this.failOnSet) throw new Error('quota exceeded')
        this.map.set(key, value)
    }

    removeItem(key: string): void {
        if (this.failAll) throw new Error('storage unavailable')
        this.map.delete(key)
    }

    get size(): number {
        return this.map.size
    }
}

/**
 * 冲刷微任务链
 * @description 引擎内部为 `async` 扫描链（listCandidates → claim → notify → consume），
 *              假定时器下每轮 `advanceTimersByTimeAsync` 未必跑完整条链 ⇒ 统一冲刷，
 *              避免用例依赖实现内部的 await 层数。
 */
export const flushMicrotasks = async (rounds = 12): Promise<void> => {
    for (let i = 0; i < rounds; i += 1) await Promise.resolve()
}

/** 记录调用顺序的日志（断言「落账先于通知、消费后于通知」） */
export const createCallLog = (): string[] => []

/** ISO 时间助手：基准 + 偏移毫秒 */
export const isoOffset = (baseMs: number, offsetMs: number): string =>
    new Date(baseMs + offsetMs).toISOString()