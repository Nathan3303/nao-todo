<script setup lang="ts">
import { computed } from 'vue'
import { TaskBasicInfo } from '../task-basic-info'
import { TaskStatePresets } from './constants'
import type { TaskStateInfoProps } from './types'

defineOptions({ name: 'TaskStateInfo' })
const props = defineProps<TaskStateInfoProps>()

const info = computed(() => {
    return TaskStatePresets[props.state as keyof typeof TaskStatePresets]
})
</script>

<template>
    <task-basic-info :icon="info[0]" :text="info[1]" :clamped="1" />
</template>

<style scoped>
.nue-div--basic-info {
    min-height: 1rem;
    flex: 1;
}
</style>

