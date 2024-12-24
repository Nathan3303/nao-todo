<template>
    <nue-div align="center" gap="4px" wrap="nowrap">
        <nue-icon :name="info[0]" color="var(--primary-color-800)" style="--icon-weight: normal" />
        <nue-text :clamped="useClamped ? 1 : void 0" color="var(--primary-color-800)" size="12px">
            {{ info[1] }}
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@nao-todo/types'

const props = defineProps<{
    state: Todo['state']
    useClamped?: boolean
}>()

const info = computed(() => {
    switch (props.state) {
        case 'todo':
            return ['circle', '待办']
        case 'in-progress':
            return ['in-progress', '正在进行']
        case 'done':
            return ['success-fill', '已完成']
        default:
            return ['circle', '待办']
    }
})
</script>
