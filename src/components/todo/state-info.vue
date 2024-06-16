<template>
    <nue-div align="center" style="width: 96px" gap="4px">
        <nue-icon :name="iconName"></nue-icon>
        <nue-text size="12px">{{ state }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '../../stores/useTodoStore'

const props = defineProps<{ state: Todo['state'] }>()

const iconName = computed(() => {
    const { state } = props
    switch (state) {
        case 'Done':
            return 'success-fill'
        case 'In progress':
            return 'in-progress'
        case 'To Do':
            return 'circle'
    }
})
</script>
