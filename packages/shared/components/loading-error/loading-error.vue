<script setup lang="ts">
import { Loading as LoadingComponent } from '../loading'
import type { LoadingErrorProps } from './types'

defineOptions({ name: 'LoadingError' })
withDefaults(defineProps<LoadingErrorProps>(), {
    loading: true,
    loadingMessage: '加载中...',
    errorMessage: '加载失败, 请刷新页面重试',
    emptyMessage: '暂无数据',
    emptyImageSrc: '',
    emptyImageSize: '6rem'
})
</script>

<template>
    <loading-component v-if="loading" :placeholder="loadingMessage" />
    <nue-empty
        v-else-if="error"
        :image-src="errorImageSrc"
        :image-size="errorImageSize"
        :description="$slots.error ? '' : errorMessage"
    >
        <slot name="error"></slot>
    </nue-empty>
    <nue-empty
        v-else-if="empty"
        :image-src="emptyImageSrc"
        :image-size="emptyImageSize"
        :description="$slots.empty ? '' : emptyMessage"
    >
        <slot name="empty"></slot>
    </nue-empty>
    <slot v-else-if="$slots.default" />
    <!--
      SHELL-03 F-5/C-01 安全兜底：loading/error/empty 三态皆不匹配且调用方**未提供** default slot 时，
      原先落到 `<slot v-else />` ⇒ 渲染空（“无匹配 ⇒ 空”类缺陷）。现渲染最小 empty 占位。
      注：既有 12 处调用方均带默认子内容 ⇒ 零行为变化。
    -->
    <nue-empty
        v-else
        :image-src="emptyImageSrc"
        :image-size="emptyImageSize"
        :description="emptyMessage"
    />
</template>

<style scoped>
.nue-empty {
    height: 100%;
    padding: var(--nue-padding-df);

    &:deep(> .nue-text) {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }
}
</style>