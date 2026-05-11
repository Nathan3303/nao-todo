<template>
    <nue-div theme="language-wrapper">
        <nue-div theme="title-wrapper">
            <nue-text theme="title">语言设置</nue-text>
            <nue-text theme="description">选择一个你喜欢的语言作为应用语言吧</nue-text>
        </nue-div>
        <nue-div theme="body">
            <nue-select v-model="selectedLanguage">
                <nue-select-option label="中文（简体）" value="zh-CN" />
            </nue-select>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'SettingsAppLanguage' })

const selectedLanguage = ref('zh-CN')
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
