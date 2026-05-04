<script setup lang="ts">
import { computed } from 'vue'
import { TaskBasicInfo } from '../task-basic-info'
import { TaskPriorityPresets } from './constants'
import type { TaskPriorityInfoProps } from './types'

defineOptions({ name: 'TaskPriorityInfo' })
const props = defineProps<TaskPriorityInfoProps>()

const info = computed(() => TaskPriorityPresets[props.priority as keyof typeof TaskPriorityPresets])
</script>

<template>
    <task-basic-info :icon="info[0]" :text="info[1]" :clamped="useClamped ? 1 : void 0" />
</template>

<style scoped>
.nue-div--basic-info {
    min-height: 1rem;
    flex: 1;
}
</style>

