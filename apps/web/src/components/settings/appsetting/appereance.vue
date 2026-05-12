<template>
    <nue-div theme="appereance-wrapper">
        <nue-text theme="title">
            外观设置
            <nue-icon :name="loading ? 'loading' : 'check'" size="16px" v-if="loading" />
        </nue-text>
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
                    <div class="theme-card__preview" :class="option.previewClass">
                        <div class="preview-window">
                            <div class="preview-header"></div>
                            <div class="preview-content">
                                <div class="preview-line"></div>
                                <div class="preview-line short"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Info Area -->
                    <div class="theme-card__info">
                        <nue-icon :name="option.icon" size="16px" />
                        <nue-text size="12px">{{ option.label }}</nue-text>
                    </div>

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

const themeOptions: Array<{ value: ThemeMode; label: string; icon: string; previewClass: string }> =
    [
        {
            value: 'light',
            label: '浅色',
            icon: 'sun',
            previewClass: 'theme-preview-light'
        },
        {
            value: 'dark',
            label: '深色',
            icon: 'moon',
            previewClass: 'theme-preview-dark'
        },
        {
            value: 'system',
            label: '跟随系统',
            icon: 'desktop',
            previewClass: 'theme-preview-system'
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
        gap: 1.5rem;
        margin-top: 0.5rem;

        .theme-cards {
            display: flex;
            flex-direction: row;
        }

        .theme-card {
            position: relative;
            height: 160px;
            border-radius: 12px;
            border: 1px solid var(--nue-primary-color-500);
            background: var(--nue-primary-color-500);
            cursor: pointer;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            flex: 1;
            min-width: 140px;
        }

        .theme-card:hover {
            box-shadow: var(--nue-primary-shadow);
        }

        .theme-card--active {
            border-color: var(--nue-primary-color-500);
        }

        .theme-card__preview {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px;
            background: var(--nue-primary-color-500);
        }

        .preview-window {
            width: 100%;
            height: 70px;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .preview-header {
            height: 16px;
            border-bottom: 1px solid;
        }

        .preview-content {
            flex: 1;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .preview-line {
            height: 6px;
            border-radius: 3px;
            opacity: 0.6;
        }

        .preview-line.short {
            width: 60%;
        }

        .theme-preview-light .preview-window {
            background: #ffffff;
            border: 1px solid #e0e0e0;
        }

        .theme-preview-light .preview-header {
            background: #f5f5f5;
            border-bottom-color: #e0e0e0;
        }

        .theme-preview-light .preview-line {
            background: #bdbdbd;
        }

        .theme-preview-dark .preview-window {
            background: #1a1a1a;
            border: 1px solid #333;
        }

        .theme-preview-dark .preview-header {
            background: #2a2a2a;
            border-bottom-color: #333;
        }

        .theme-preview-dark .preview-line {
            background: #555;
        }

        .theme-preview-system .preview-window {
            background: linear-gradient(90deg, #ffffff 50%, #1a1a1a 50%);
            border: 1px solid #ccc;
        }

        .theme-preview-system .preview-header {
            background: linear-gradient(90deg, #f5f5f5 50%, #2a2a2a 50%);
            border-bottom-color: #999;
        }

        .theme-preview-system .preview-line {
            background: linear-gradient(90deg, #bdbdbd 50%, #555 50%);
        }

        .theme-card__info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px;
            border-top: 1px solid var(--nue-primary-color-300);
            background: var(--nue-primary-color-100);
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

@media (max-width: 768px) {
    .nue-div--appereance-wrapper {
        .nue-div--body {
            .theme-cards {
                flex-direction: column;
                gap: 1rem;
            }

            .theme-card {
                height: 120px;
                flex-direction: row;
                min-width: 100%;
                width: 100%;
            }

            .theme-card__preview {
                flex: 1;
                padding: 16px;
            }

            .preview-window {
                height: 80px;
                max-width: 200px;
            }

            .theme-card__info {
                width: 100px;
                border-top: none;
                border-left: 1px solid var(--nue-primary-color-300);
                flex-direction: column;
                gap: 8px;
                padding: 16px 12px;
            }

            .theme-card__check {
                top: 12px;
                right: 12px;
                width: 24px;
                height: 24px;
            }
        }
    }
}

@media (max-width: 480px) {
    .nue-div--appereance-wrapper {
        gap: 0.75rem;

        .nue-text--title {
            font-size: var(--nue-text-df);
        }

        .nue-div--body {
            gap: 1rem;
            margin-top: 0.25rem;

            .theme-card {
                height: 100px;
                border-radius: 10px;
            }

            .theme-card__preview {
                padding: 12px;
            }

            .preview-window {
                height: 65px;
                max-width: 160px;
            }

            .preview-header {
                height: 14px;
            }

            .preview-content {
                padding: 6px;
                gap: 5px;
            }

            .preview-line {
                height: 5px;
            }

            .theme-card__info {
                width: 85px;
                padding: 12px 8px;
                gap: 6px;
            }

            .theme-card__check {
                top: 8px;
                right: 8px;
                width: 20px;
                height: 20px;
            }
        }
    }
}
</style>

