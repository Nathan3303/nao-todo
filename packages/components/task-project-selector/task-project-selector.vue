<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectViewObject } from '@nao-todo/types'
import type { TaskProjectSelectorProps, TaskProjectSelectorEmits } from './types'

defineOptions({ name: 'TaskProjectSelector', inheritAttrs: false })
const props = defineProps<TaskProjectSelectorProps>()
const emit = defineEmits<TaskProjectSelectorEmits>()

const vm = computed({
    get: () => {
        const p = props.projects.find((p) => p.id === props.projectId)
        if (!p) return 'inbox'
        return p.id
    },
    set: (newProjectId) => handleSelect(newProjectId)
})

const handleSelect = async (projectId: ProjectViewObject['id']) => {
    emit('select', projectId)
    return
}
</script>

<template>
    <nue-select v-model="vm" size="small">
        <nue-select-option icon="inbox" label="收集箱" :value="'inbox'" />
        <nue-divider />
        <template v-if="projects && projects.length">
            <nue-select-option
                v-for="(project, index) in projects"
                :key="index"
                icon="more2"
                :label="project.name"
                :value="project.id"
            />
        </template>
        <nue-text v-else theme="empty">暂无自建清单</nue-text>
    </nue-select>
</template>

<style>
.nue-text--empty {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-500);
    padding: 0.5rem;
    text-align: center;
}
</style>

