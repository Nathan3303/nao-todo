<script setup lang="ts">
import { AppAsideAdapter } from '@/components/app'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import { SettingsViewRouteLinks as routeLinks } from '@/views/index/settings/routes'
import { t, type LocaleKey } from '@nao-todo/shared'
import { inject } from 'vue'

defineOptions({ name: 'SettingsAside' })

// @context Settingsview 任务视图上下文
const { asideWidth, handleResizeAside, isDisplayAside } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <app-aside-adapter
        @resize="handleResizeAside"
        v-model:displayed="isDisplayAside"
        :width="asideWidth"
        :min-width="isDisplayAside ? '250px' : 'unset'"
        max-width="350px"
    >
        <nue-div v-if="isDisplayAside" theme="aside-wrapper">
            <nue-div vertical gap="0.5rem">
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
    </app-aside-adapter>
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
