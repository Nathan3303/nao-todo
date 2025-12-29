<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectVO } from '@nao-todo/types'

type TodoProjectSelectorProps = {
    projects: ProjectVO[]
    projectId?: ProjectVO['id']
    placeholder?: string
    placement?: string
}
type TodoProjectSelectorEmits = {
    (event: 'select', projectId: ProjectVO['id'], projectTitle?: ProjectVO['name']): void
}

defineOptions({ name: 'TodoProjectSelector', inheritAttrs: false })
const props = defineProps<TodoProjectSelectorProps>()
const emit = defineEmits<TodoProjectSelectorEmits>()

const vm = computed({
    get: () => props.projectId,
    set: (newProjectId) => handleSelect(newProjectId)
})

const buttonText = computed(() => {
    const projectTitle = props.projects.find((project) => project.id === props.projectId)?.name
    if (props.projectId === '') {
        return props.placeholder || '移动到清单 ...'
    }
    return projectTitle || '收集箱'
})

const handleSelect = async (projectId?: ProjectVO['id']) => {
    if (projectId) {
        emit('select', projectId)
        return
    }
    emit('select', '', '收集箱')
}
</script>

<template>
    <nue-select v-model="vm" size="small" :placeholder="buttonText" theme="project-selector">
        <nue-select-option icon="inbox" label="收集箱" :value="''" />
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
.nue-select.nue-select--project-selector {
    /*  size="11px" color="gray" style="padding: 8px" align="center" */
    > .nue-text--empty {
        font-size: var(--nue-text-xs);
        color: var(--nue-text-color-400);
        padding: 0.5rem;
        text-align: center;
    }
}
</style>

