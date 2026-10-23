/**
 * 提醒弹窗：**同步导出**（有意偏离 dialog-async 约定，一次性例外，T527/F1）
 * @description 注册必须与 `<app-dialog-adapter>` 同一次 flush 完成：异步组件的 `onMounted` 可能落在
 *              后续 tick ⇒ 引擎 `claim→notify` 时 `DialogManager.open` 因未注册而丢弃，而该条已落账 +
 *              已消费 ⇒ 永久不再出现。体积实测（webapp build）：task chunk +2,880 B（gzip +924 B）、
 *              异步 chunk `task-reminder` 3,428 B 消失、全量 JS −514 B、请求数 −1；`dialog-adapter`
 *              无条件渲染全部 dialog ⇒ 异步 chunk 首屏即被请求，分割实益≈0，故此处同步。
 */
export { default } from './task-reminder.vue'