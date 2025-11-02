<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@nao-todo/types'

defineOptions({ name: 'TodoProjectSelector' })
const props = defineProps<{
    userId: Project['userId']
    projects: Project[]
    projectId?: Project['id']
    placeholder?: string
    placement?: string
}>()
const emit = defineEmits<{
    (event: 'select', projectId: Project['id'], projectTitle?: Project['name']): void
}>()

const vm = computed({
    get: () => props.projectId,
    set: (newProjectId) => {
        console.log('newProjectId', newProjectId)
        handleSelect(newProjectId)
    }
})

// const buttonIconName = computed(() => {
//     const { projectId, userId } = props
//     if (projectId === '') return 'projects'
//     return projectId !== userId ? 'more2' : 'inbox'
// })

const buttonText = computed(() => {
    const { projectId, placeholder } = props
    const projectTitle = props.projects.find((project) => project.id === projectId)?.name
    if (projectId === '') return placeholder || '移动到'
    return projectTitle || '收集箱'
})

const handleSelect = async (projectId?: Project['id']) => {
    if (projectId) {
        emit('select', projectId)
        return
    }
    emit('select', props.userId, '收集箱')
}
</script>

<template>
    <!-- <nue-dropdown :placement="(placement as never) ?? 'bottom-end'" theme="project-selector">
        <template #trigger="{ trigger }">
            <nue-button size="small" :icon="buttonIconName" @click="trigger">
                {{ buttonText }}
            </nue-button>
        </template>
        <template #default>
            <nue-div class="nue-dropdown-item" @click="handleSelect" gap="0.5rem">
                <nue-icon name="inbox" size="12px" />
                <nue-text size="12px" style="flex: auto">收集箱</nue-text>
                <nue-icon v-if="projectId === userId" name="check" />
            </nue-div>
            <nue-divider />
            <template v-if="projects && projects.length">
                <nue-div
                    v-for="(project, index) in projects"
                    :key="index"
                    class="nue-dropdown-item"
                    :data-selected="project.id === projectId"
                    @click="handleSelect(project.id, project.name)"
                    gap="0.5rem"
                    wrap="nowrap"
                >
                    <nue-icon name="more2" size="12px" />
                    <nue-text size="12px" style="flex: auto" :clamped="2">{{ project.name }}</nue-text>
                    <nue-icon v-if="project.id === projectId" name="check" />
                </nue-div>
            </template>
            <nue-text v-else size="11px" color="gray" style="padding: 8px" align="center">
                暂无自建清单
            </nue-text>
        </template>
    </nue-dropdown> -->
    <nue-select v-model="vm" size="small" :placeholder="buttonText">
        <nue-select-option icon="inbox" label="收集箱" :value="userId" />
        <nue-divider />
        <template v-if="projects && projects.length">
            <nue-select-option
                v-for="(project, index) in projects"
                :key="index"
                :label="project.name"
                :value="project.id"
            />
        </template>
        <nue-text v-else size="11px" color="gray" style="padding: 8px" align="center">
            暂无自建清单
        </nue-text>
    </nue-select>
</template>

<style>
.nue-dropdown.nue-dropdown--project-selector {
    min-width: 12rem;
    width: max-content;
    max-width: 80%;
}
</style>

