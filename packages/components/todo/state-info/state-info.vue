<template>
    <nue-div align="center" style="width: 80px" gap="4px">
        <nue-icon :name="info[0]" style="--icon-weight: normal"></nue-icon>
        <nue-text size="12px">{{ info[1] }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@/stores/use-todo-store'

const props = defineProps<{ state: Todo['state'] }>()

const info = computed(() => {
    const { state } = props
    switch (state) {
        case 'todo':
            return ['circle', '待办']
        case 'in-progress':
            return ['in-progress', '正在进行']
        case 'done':
            return ['success-fill', '已完成']
    }
})
</script>
