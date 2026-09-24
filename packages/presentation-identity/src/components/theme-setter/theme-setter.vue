<script setup lang="ts">
import { debounce } from '@nao-todo/shared/utils/commons'
import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { NueMessage } from 'nue-ui'
import { computed, ref } from 'vue'
import { useThemeStore } from '../../stores'
import type { ThemeMode } from '@nao-todo/domain-identity'
import type { ThemeSetterOption, ThemeSetterProps } from './types'

defineOptions({ name: 'ThemeSetter' })
const props = defineProps<ThemeSetterProps>()

const themeStore = useThemeStore()

const themeOptions: ThemeSetterOption[] = [
    {
        value: 'light',
        label: t('settings.appearanceLight'),
        icon: 'sun',
        previewImage: assetUrl('/images/naotodo-theme-mode-light.png')
    },
    {
        value: 'dark',
        label: t('settings.appearanceDark'),
        icon: 'moon',
        previewImage: assetUrl('/images/naotodo-theme-mode-dark.png')
    },
    {
        value: 'system',
        label: t('settings.appearanceSystem'),
        icon: 'desktop',
        previewImage: assetUrl('/images/naotodo-theme-mode-system.png')
    }
]
const loading = ref(false)

const currentTheme = computed(() => themeStore.themeMode)

const debounceUpdateUserTheme = debounce((mode: ThemeMode) => {
    props.userUseCase
        .updateUserConfig({ appearance: mode })
        .then((updateErr) => {
            if (updateErr === null) return
            NueMessage.error(`${t('settings.appearanceSyncFailed')}：${unwrapError(updateErr)}`)
        })
        .finally(() => {
            loading.value = false
        })
}, 500)

const selectTheme = async (mode: ThemeMode) => {
    loading.value = true
    themeStore.setTheme(mode)
    debounceUpdateUserTheme(mode)
}
</script>

<template>
    <nue-div theme="appereance-wrapper">
        <nue-div>
            <nue-text theme="title">{{ t('settings.appearance') }}</nue-text>
            <nue-icon v-show="loading" :name="loading ? 'loading' : 'check'" spin size="1rem" />
        </nue-div>
        <nue-text theme="description">{{ t('settings.appearanceDesc') }}</nue-text>
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

        .theme-card {
            position: relative;
            cursor: pointer;
            box-sizing: border-box;
            width: 8rem;
            aspect-ratio: 16 / 9;
            border-radius: var(--nue-primary-radius);
            overflow: hidden;

            &:hover {
                box-shadow: var(--nue-secondary-shadow);
            }

            .preview-image {
                width: 100%;
                height: 100%;
                object-fit: fill;
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