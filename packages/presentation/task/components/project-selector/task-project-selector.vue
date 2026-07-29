<script setup lang="ts">
import { computed } from 'vue'
import type { TaskProjectViewObject } from '@nao-todo/domain-task/viewobjects'
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

const handleSelect = async (projectId: TaskProjectViewObject['id']) => {
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
        <nue-text
            v-else
            theme="no-project"
            color="var(--nue-primary-color-900)"
            size="var(--nue-text-xs)"
            align="center"
        >
            暂无自建清单
        </nue-text>
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
.nue-dropdown {
    .nue-text--no-project {
        color: var(--nue-primary-color-600);
        size: var(--nue-text-xs);
        text-align: center;
        padding: var(--nue-padding-xs);
    }
    .nue-dropdown-item.nue-select-option--project-selector {
        gap: var(--nue-gap-xs);
    }
}
</style>
