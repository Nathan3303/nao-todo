<script setup lang="ts">
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import { SettingsViewRouteLinks as routeLinks } from '@/views/index/settings/routes'
import { t, type LocaleKey } from '@nao-todo/shared'
import { inject, nextTick, onMounted, ref, watch } from 'vue'

defineOptions({ name: 'SettingsAside' })

// @contexts
const { isDisplayAside } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="(link, idx) in routeLinks"
                    :icon="link.icon"
                    :key="idx"
                    :route="link.route"
                    theme="route"
                >
                    {{ t(link.title as LocaleKey) }}
                </nue-link>
            </nue-div>
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--aside-wrapper {
    flex-direction: column;
    box-sizing: border-box;
    padding: var(--nue-padding-df);
    overflow: auto;
    flex: 1;
}
</style>
