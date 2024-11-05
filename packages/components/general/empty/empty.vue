<template>
    <nue-div
        class="empty"
        v-if="empty"
        warp="nowrap"
        align="center"
        :justify="align"
        :height="fullHeight ? '100%' : 'auto'"
        flex
    >
        <nue-text :size="textSize" :color="textColor">
            {{ message }}
        </nue-text>
    </nue-div>
    <slot v-else></slot>
</template>

<script setup lang="ts">
import type { EmptyProps } from './types'

defineOptions({ name: 'Empty' })
withDefaults(defineProps<EmptyProps>(), {
    message: '没有数据',
    textSize: '14px',
    textColor: 'gray',
    align: 'center',
    fullHeight: false
})
</script>

<style scoped>
.nue-text {
    margin: 16px 0;
}
</style>
