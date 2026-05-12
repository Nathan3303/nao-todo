<template>
    <nue-div theme="appereance-wrapper">
        <nue-div>
            <nue-text theme="title"> 外观设置 </nue-text>
            <nue-icon v-show="loading" :name="loading ? 'loading' : 'check'" spin size="1rem" />
        </nue-div>
        <nue-text theme="description">自定义视觉与感受，选择你喜欢的主题！</nue-text>
        <nue-div theme="body">
            <!-- Theme Cards Container -->
            <nue-div class="theme-cards" gap="1rem" wrap="wrap">
                <div
                    v-for="option in themeOptions"
                    :key="option.value"
                    class="theme-card"
                    :class="{ 'theme-card--active': currentTheme === option.value }"
                    @click="selectTheme(option.value)"
                >
                    <!-- Preview Area -->
                    <div class="theme-card__preview">
                        <img :src="option.previewImage" :alt="option.label" class="preview-image" />
                    </div>

                    <!-- Info Area -->
                    <!-- <div class="theme-card__info"> -->
                    <!-- <nue-text>{{ option.label }}</nue-text> -->
                    <!-- </div> -->

                    <!-- Check Indicator -->
                    <div v-if="currentTheme === option.value" class="theme-card__check">
                        <nue-icon name="check" size="14px" />
                    </div>
                </div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useThemeStore, type ThemeMode } from '@/stores'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import { NueMessage } from 'nue-ui'

defineOptions({ name: 'SettingsAppAppereance' })

const themeStore = useThemeStore()

const themeOptions: Array<{
    value: ThemeMode
    label: string
    icon: string
    previewImage: string
}> = [
    {
        value: 'light',
        label: '浅色',
        icon: 'sun',
        previewImage: '/images/naotodo-theme-mode-light.png'
    },
    {
        value: 'dark',
        label: '深色',
        icon: 'moon',
        previewImage: '/images/naotodo-theme-mode-dark.png'
    },
    {
        value: 'system',
        label: '跟随系统',
        icon: 'desktop',
        previewImage: '/images/naotodo-theme-mode-system.png'
    }
]
const loading = ref(false)

const { userUseCase } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!

const currentTheme = computed(() => themeStore.themeMode)

const selectTheme = async (mode: ThemeMode) => {
    loading.value = true
    themeStore.setTheme(mode)
    const updateError = await userUseCase.updateUserConfig({ appearance: mode })
    loading.value = false
    if (updateError === null) return
    NueMessage.error(`主题同步失败：${unwrapError(updateError)}`)
}
</script>

<style scoped>
.nue-div--appereance-wrapper {
    flex-direction: column;
    gap: 0.5rem;

    .nue-text--title {
        font-size: var(--nue-text-df);
    }

    .nue-text--description {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-500);
    }

    .nue-div--body {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 1rem;
        margin-top: 0.5rem;

        .theme-card {
            position: relative;
            cursor: pointer;
            overflow: hidden;
            box-sizing: border-box;
            flex: auto;
            width: 30%;
            max-width: 20rem;
            aspect-ratio: 16/9;
            border: 2px solid var(--nue-border-color);
            border-radius: var(--nue-primary-radius);
            box-shadow: var(--nue-secondary-shadow);

            &:hover {
                transform: translateY(-0.25rem);
                transition: transform var(--nue-animation-duration-short) linear;
            }

            .preview-image {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            .theme-card__info {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--nue-padding-sm);
                font-size: var(--nue-text-sm);
            }

            .theme-card__check {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--nue-success-color-50);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--nue-primary-color-0);
            }
        }
    }
}
</style>

