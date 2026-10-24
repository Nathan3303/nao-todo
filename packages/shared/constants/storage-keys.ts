/**
 * 设备级 localStorage 键（跨端共享的单一真源）
 */

/**
 * 明文姿态「首次进入」告知已读标记
 * @description **设备级**键：`apps/web` 的首次进入横幅与 `infrastructure` 的登出清库白名单共用；
 *              必须保持同一字面量（漂移 ⇒ 登出后被清 ⇒ 每次登出重复弹出）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（§4.5）
 */
export const PLAINTEXT_NOTICE_ACK_KEY = 'nao.plaintextNoticeAck'

/**
 * 提醒权限「一次性说明」已提示状态（T531 / AC9）
 * @description **设备级**键：通知权限是「本浏览器 / 本设备」属性而非账号属性 ⇒
 *              登出后必须保留，否则每次登出都会重复打扰；值与 `PLAINTEXT_NOTICE_ACK_KEY` 同范式
 *              （单一字面量真源，Web 设置区与清库白名单共用）。
 */
export const REMINDER_NOTICE_ACK_KEY = 'REMINDER_NOTICE_ACK'