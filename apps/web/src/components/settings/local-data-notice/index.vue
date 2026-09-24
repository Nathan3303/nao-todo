<script setup lang="ts">
/**
 * 设置页「本地数据与安全」明文声明（ADR §4.5 / RS-1 / RS-3 / RS-4 / AC17）
 * @description 告知本机数据的真实姿态与风险边界：明文保存、设备即凭据、来源/同机页面边界、
 *              浏览器驱逐、两端差异。**不**使用「加密」字样，也不写「已加密/受保护」这类虚假安全感。
 *              两端复用（desktop 经 `@` 别名复用本源码）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（§4.5 / §4.2 / §4.4）
 */
import { t } from '@nao-todo/shared/locales'

defineOptions({ name: 'SettingsLocalDataNotice' })
</script>

<template>
    <nue-div vertical gap=".75rem">
        <nue-text>{{ t('settings.localData.title') }}</nue-text>
        <nue-text size=".875rem" color="gray">
            {{ t('settings.localData.desc') }}
        </nue-text>
        <ul class="local-data-notice__list">
            <li>
                <nue-text size=".875rem" color="gray">
                    {{ t('settings.localData.plaintext') }}
                </nue-text>
            </li>
            <li>
                <nue-text size=".875rem" color="gray">
                    {{ t('settings.localData.device') }}
                </nue-text>
            </li>
            <li>
                <nue-text size=".875rem" color="gray">
                    {{ t('settings.localData.boundary') }}
                </nue-text>
            </li>
            <li>
                <nue-text size=".875rem" color="gray">
                    {{ t('settings.localData.eviction') }}
                </nue-text>
            </li>
            <li>
                <nue-text size=".875rem" color="gray">
                    {{ t('settings.localData.endDifference') }}
                </nue-text>
            </li>
        </ul>
    </nue-div>
</template>

<style scoped>
.local-data-notice__list {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    margin: 0;
    padding-left: 1.125rem;
    list-style: disc;
}
</style>