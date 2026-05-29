<script setup lang="ts">
import { Loading as LoadingComponent } from '../loading'
import type { LoadingErrorProps } from './types'

defineOptions({ name: 'LoadingError' })
defineProps<LoadingErrorProps>()
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

<style scoped></style>

