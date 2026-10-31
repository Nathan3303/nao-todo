<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from '@nao-todo/domain-task'
import { TaskBasicInfo } from '../task-basic-info'
import { TaskPriorityPresets } from './constants'
import type { TaskPriorityInfoProps } from './types'

defineOptions({ name: 'TaskPriorityInfo' })
const props = defineProps<TaskPriorityInfoProps>()

// 白名单外（脏值）回落默认档位：不抛错、不出现空白标签（PRD AC4 / R2）
const info = computed(
    () =>
        TaskPriorityPresets.value[props.priority as TaskPriority] ??
        TaskPriorityPresets.value[DEFAULT_TASK_PRIORITY]
)
</script>

<template>
    <task-basic-info :icon="info[0]" :text="info[1]" :clamped="useClamped ? 1 : void 0" />
</template>

<style scoped>
.nue-div--basic-info {
    min-height: 1rem;
    flex: 1;
    color: v-bind('info[2]') !important;
}
</style>