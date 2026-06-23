<script setup lang="ts">
import { Loading as LoadingComponent } from '../loading'
import type { LoadingErrorProps } from './types'

defineOptions({ name: 'LoadingError' })
withDefaults(defineProps<LoadingErrorProps>(), {
    loading: true,
    loadingMessage: '加载中...',
    errorMessage: '加载失败, 请刷新页面重试',
    emptyMessage: '暂无数据',
    emptyImageSrc: '/images/empty.png',
    emptyImageSize: '8rem'
})
</script>

<template>
    <loading-component v-if="loading" :placeholder="loadingMessage" />
    <nue-empty
        v-else-if="error"
        :image-src="errorImageSrc"
        :image-size="errorImageSize"
        :description="$slots.error ? '' : errorMessage"
        style="height: 100%"
    >
        <slot name="error"></slot>
    </nue-empty>
    <nue-empty
        v-else-if="empty"
        :image-src="emptyImageSrc"
        :image-size="emptyImageSize"
        :description="$slots.empty ? '' : emptyMessage"
        style="height: 100%"
    >
        <slot name="empty"></slot>
    </nue-empty>
    <slot v-else />
</template>

<style scoped>
.nue-empty {
    height: 100%;
    margin: var(--nue-padding-df);

    &:deep(> .nue-text) {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }
}
</style>

