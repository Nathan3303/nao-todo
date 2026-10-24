/**
 * 提醒本地轮询（T527）
 * @description 单一判定实现（PRD AC10）：本机数据 + 本机时钟判定，跨 Web / 桌面共用一套。
 *              纯核心 `collectDueReminders` / `nextOccurrence`、去重账本 `createClaimLedger`、
 *              引擎工厂 `createReminderEngine`（依赖全部端口注入）。
 *              用例契约（导出清单 / deps 形状 / claim→notify→consume 顺序）：
 *              `__tests__/reminder-harness.ts`。
 */
export * from './collect-due-reminders'
export * from './next-occurrence'
export * from './claim-ledger'
export * from './quiet-hours'
export * from './reminder-settings'
export * from './create-reminder-engine'
export type * from './types'