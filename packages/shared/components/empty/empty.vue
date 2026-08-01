<template>
    <nue-div theme="empty" v-if="empty" :justify="alignment" :height="height">
        <nue-text theme="message" :size="textSize" :color="textColor">
            {{ message }}
        </nue-text>
    </nue-div>
    <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmptyProps } from './types'

defineOptions({ name: 'Empty' })
const props = withDefaults(defineProps<EmptyProps>(), {
    message: '没有数据',
    textSize: '14px',
    textColor: 'gray',
    alignment: 'center',
    fullHeight: false
})

const height = computed(() => (props.fullHeight ? '100%' : 'auto'))
</script>

<style scoped>
.nue-div--empty {
    flex-wrap: nowrap;
    align-items: center;
    flex: auto;
}
</style>