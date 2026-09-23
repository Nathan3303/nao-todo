<script setup lang="ts">
/**
 * 明文姿态 · 首次进入一次性告知（ADR §4.5 / D1b / AC17）
 * @description 首次进入应用时展示一次「本地数据为明文保存 + 风险边界」横幅；
 *              可关闭、**不阻塞使用**（非模态，不拦截交互）；关闭即写设备级已读标记，之后不再展示。
 *              两端复用（desktop 经 `@` 别名复用本源码）⇒ 仅在主界面挂载（`views/index`）。
 *              文案回避「加密」字样，且不得给出「已加密/受保护」式虚假安全感。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（§4.5 / RS-1 / RS-3 / RS-4）
 */
import { ref } from 'vue'
import { t } from '@nao-todo/shared'
import { acknowledgePlaintextNotice, isPlaintextNoticeAcknowledged } from './plaintext-notice'

defineOptions({ name: 'PlaintextNoticeBanner' })

const visible = ref(!isPlaintextNoticeAcknowledged())

const dismiss = (): void => {
    acknowledgePlaintextNotice()
    visible.value = false
}
</script>

<template>
    <div v-if="visible" class="plaintext-notice" role="status" aria-live="polite">
        <div class="plaintext-notice__text">
            <nue-text size=".875rem" color="var(--nue-warning-color-60)">
                {{ t('notice.plaintext.title') }}
            </nue-text>
            <nue-text size="xs" color="var(--nue-secondary-text-color)">
                {{ t('notice.plaintext.body') }}
            </nue-text>
        </div>
        <nue-button theme="ghost,small" @click="dismiss">
            {{ t('notice.plaintext.dismiss') }}
        </nue-button>
    </div>
</template>

<style scoped>
.plaintext-notice {
    display: flex;
    align-items: flex-start;
    gap: var(--nue-gap-sm);
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border-bottom: 1px solid var(--nue-warning-color-30);
    background-color: var(--nue-warning-color-10);
}

.plaintext-notice__text {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    flex: 1;
    min-width: 0;
}
</style>