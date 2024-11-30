<template>
    <nue-div align="center" style="width: 80px" gap="4px">
        <nue-icon :name="info[0]" style="--icon-weight: normal" />
        <nue-text size="12px" color="var(--primary-color-800)">{{ info[1] }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@nao-todo/types'

const props = defineProps<{
    state: Todo['state']
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
