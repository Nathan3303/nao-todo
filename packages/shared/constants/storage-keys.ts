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