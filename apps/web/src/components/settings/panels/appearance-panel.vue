<script setup lang="ts">
/**
 * 设置「外观与语言」分类面板（T535）
 * @description 主题（浅色 / 深色 / 跟随系统）与界面语言两组既有控件，原样复用 `presentation-identity`
 *              的 setter（主题存储、偏好同步、语言切换语义零改动），只换容器与版式。
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC5 零行为回归）
 */
import { inject } from 'vue'
import { UserLanguageSetter, UserThemeSetter } from '@nao-todo/presentation-identity'
import { t } from '@nao-todo/shared/locales'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'

defineOptions({ name: 'SettingsAppearancePanel' })

const { userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <div class="sd-cat" data-settings-category="appearance">
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.appearance.name') }}</h2>
                <p class="sd-group__desc" data-settings-desc>
                    {{ t('settings.ia.appearance.desc') }}
                </p>
            </header>
            <div class="sd-row sd-row--block" data-setting-id="theme">
                <user-theme-setter :user-use-case="userUseCase" />
            </div>
            <div class="sd-row sd-row--block" data-setting-id="language">
                <user-language-setter />
            </div>
        </section>
    </div>
</template>