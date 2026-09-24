/**
 * 旧密文一次性自愈 · 可见告知（DEF-35 / C-68）
 * @description 自愈发生在 `startWebDataPlane()` 后台接线中，由 `NueConfirm` 单按钮模态告知：
 *              - `rebuilt`：本地不可读的旧密文副本已丢弃并重建，将从服务器重新同步；
 *              - `blocked`：检测到旧密文但有未回传本地修改 ⇒ 先同步，**不得静默丢弃**。
 *              两种告知均为**单按钮一次性模态**（与 `plaintext-notice` 同构）。
 * @see packages/infrastructure/src/persistence-local/migration/legacy-cipher-self-heal.ts
 */
import { NueConfirm } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'

/** 已重建（丢弃旧密文副本，等待全量重拉）告知 */
export const showLegacyCipherRebuiltNotice = (): void => {
    void NueConfirm({
        title: t('notice.legacyCipher.rebuiltTitle'),
        content: t('notice.legacyCipher.rebuiltBody'),
        confirmButtonText: t('notice.legacyCipher.dismiss'),
        unuseCancelButton: true
    })
}

/**
 * 自愈被阻塞告知（有 `pending` 项未回传本地写入）
 * @param pending 未回传项数（业务脏队列 + 偏好队列）
 */
export const showLegacyCipherBlockedNotice = (pending: number): void => {
    void NueConfirm({
        title: t('notice.legacyCipher.blockedTitle'),
        content: t('notice.legacyCipher.blockedBody', { count: pending }),
        confirmButtonText: t('notice.legacyCipher.dismiss'),
        unuseCancelButton: true
    })
}