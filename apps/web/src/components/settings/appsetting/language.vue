<template>
    <nue-div theme="language-wrapper">
        <nue-div theme="title-wrapper">
            <nue-text theme="title">{{ t('settings.language') }}</nue-text>
            <nue-text theme="description">{{ t('settings.languageDesc') }}</nue-text>
        </nue-div>
        <nue-div theme="body">
            <nue-select size="small" v-model="selectedLanguage">
                <nue-select-option :label="t('settings.languageZhCN')" value="zh-CN" />
                <!-- <nue-select-option :label="t('settings.languageEnUS')" value="en-US" /> -->
            </nue-select>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'
import useLocaleStore from '@/stores/locale-store'

defineOptions({ name: 'SettingsAppLanguage' })

const localeStore = useLocaleStore()

const selectedLanguage = computed({
    get: () => localeStore.language,
    set: (value) => localeStore.setLanguage(value)
})
</script>

<style scoped>
.nue-div--language-wrapper {
    flex-direction: row;
    gap: 0.5rem;
    align-items: top;
    justify-content: space-between;
    flex-wrap: wrap;

    .nue-div--title-wrapper {
        flex-direction: column;
        gap: 0.25rem;

        .nue-text--title {
            font-size: var(--nue-text-df);
        }

        .nue-text--description {
            font-size: var(--nue-text-sm);
            color: var(--nue-primary-color-500);
        }
    }

    .nue-div--body {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 1.5rem;
        margin-top: 0.5rem;
    }
}
</style>

