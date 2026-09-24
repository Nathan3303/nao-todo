<script setup lang="ts">
import { UserThemeSetter, UserLanguageSetter } from '@nao-todo/presentation-identity'
import { inject } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import { SettingsLocalDataNotice } from '../local-data-notice'

defineOptions({ name: 'SettingsApp' })

const { isDisplayAside, switchDisplayAside, userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!

// 应用版本号（设置页只读展示）：构建期由各端 vite `define` 从对应 package.json 注入——
// Web 构建显 webapp 版本、Desktop 构建（复用本源码）显 desktopapp 版本；
// 注入缺失（非常规构建）时降级为空串不渲染占位
const appVersion = import.meta.env.VITE_APP_VERSION || ''
</script>

<template>
    <nue-container id="SettingsAppContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.app') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <user-language-setter />
                    <nue-divider />
                    <user-theme-setter :user-use-case="userUseCase" />
                    <nue-divider />
                    <!-- 明文姿态用户可见声明（ADR §4.5 / AC17）：两端复用 -->
                    <settings-local-data-notice />
                    <nue-divider />
                    <!-- 应用版本号：只读无交互；Web 显 webapp 版本 / Desktop 显 desktopapp 版本（构建期注入） -->
                    <nue-div class="settings-app__version">
                        <nue-text size="xs" color="var(--nue-secondary-text-color)">
                            {{ t('settings.version', { version: appVersion }) }}
                        </nue-text>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
/* 版本号行：底部右侧次要文字，仅展示无交互 */
.settings-app__version {
    display: flex;
    justify-content: flex-end;
    padding: 0 var(--nue-padding-xs);
}
</style>