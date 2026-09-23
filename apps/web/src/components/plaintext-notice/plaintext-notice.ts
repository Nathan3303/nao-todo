/**
 * 明文姿态「首次进入」告知 + 已读标记（ADR §4.5 / D1b / AC17）
 * @description 一次性告知：首次进入应用弹出 `NueConfirm`（单按钮），用户确认后写入本标记 ⇒ 不再弹出。
 *              标记为**设备级**（与账号无关）⇒ 必须与
 *              `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts`
 *              的 `DEVICE_LEVEL_STORAGE_KEYS` 白名单保持一致；否则登出清库后被清 ⇒ 每次登出重复弹出。
 *              文案回避「加密」字样，且不得给出「已加密/受保护」式虚假安全感。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（§4.5 / RS-1 / RS-3 / RS-4）
 */
import { NueConfirm } from 'nue-ui'
import { PLAINTEXT_NOTICE_ACK_KEY } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'

export { PLAINTEXT_NOTICE_ACK_KEY }

/** 是否已确认过首次进入告知（localStorage 不可用时视为未确认 ⇒ 仍展示，不静默） */
export const isPlaintextNoticeAcknowledged = (): boolean => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(PLAINTEXT_NOTICE_ACK_KEY) === '1'
}

/** 记录「已确认」（幂等） */
export const acknowledgePlaintextNotice = (): void => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PLAINTEXT_NOTICE_ACK_KEY, '1')
}

/**
 * 首启明文告知（`NueConfirm` 一次性模态；替代原常驻横幅）
 * @description 仅在**未确认**时弹出；`unuseCancelButton` ⇒ 单按钮（仅「我知道了」），
 *              确认后写设备级已读标记 ⇒ 之后不再展示。模态仅出现一次，不常驻头部、不占内容区高度。
 */
export const showPlaintextNoticeConfirm = (): void => {
    if (isPlaintextNoticeAcknowledged()) return
    void NueConfirm({
        title: t('notice.plaintext.title'),
        content: t('notice.plaintext.body'),
        confirmButtonText: t('notice.plaintext.dismiss'),
        unuseCancelButton: true,
        onConfirm: () => {
            acknowledgePlaintextNotice()
        }
    })
}