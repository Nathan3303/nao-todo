<script setup lang="ts">
import { inject } from 'vue'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { AppAsideAdapter } from '@/layouts/app/'
import { SettingsViewRouteLinks as routeLinks } from '@/views/index/settings/routes'

defineOptions({ name: 'SettingsAside' })

const { asideWidth, isDisplayAside, handleResizeAside } =
    inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
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
                    {{ link.name }}
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
    flex: 1;
}
</style>

