<script lang="ts" setup>
import { SettingsAside } from '@/components/settings'
import { Loading as LoadingComp } from '@nao-todo/shared'
import useSettingsView from './settings-view'

defineOptions({ name: 'SettingsView' })

useSettingsView()
</script>

<template>
    <nue-container id="SettingsViewContainer">
        <nue-main>
            <settings-aside />
            <nue-content fill>
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #pending>
                            <loading-comp height="100%" />
                        </template>
                        <template #fallback>
                            <nue-empty image-src="/images/error.webp" image-size="6rem">
                                <nue-text size="var(--nue-text-sm)">
                                    加载失败, 请刷新页面重试
                                </nue-text>
                            </nue-empty>
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style>
.settings-view__form-row {
    gap: 0.5rem;
    flex-direction: column;
    width: min(100%, 40rem);
    align-items: stretch;
}
</style>
