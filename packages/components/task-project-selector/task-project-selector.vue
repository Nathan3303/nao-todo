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
    <nue-select theme="project-selector" v-model="vm" size="small">
        <nue-select-option icon="inbox" label="收集箱" :value="'inbox'" theme="project-selector" />
        <nue-divider />
        <template v-if="projects && projects.length">
            <nue-select-option
                v-for="(project, index) in projects"
                :key="index"
                icon="more2"
                :label="project.name"
                :value="project.id"
                theme="project-selector"
            />
        </template>
        <nue-text v-else theme="empty">暂无自建清单</nue-text>
    </nue-select>
</template>

<style scoped>
.nue-select--project-selector {
    font-size: var(--nue-text-sm);

    &:deep(.nue-button) {
        max-width: 12rem;
        font-family: var(--nue-primary-font-family);
    }
}
</style>

<style>
.nue-dropdown .nue-dropdown-item.nue-select-option--project-selector {
    gap: var(--nue-gap-xs);
}
</style>

