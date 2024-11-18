<template>
    <nue-dropdown theme="project-selector" :hide-on-click="false">
        <template #default="{ clickTrigger }">
            <nue-button size="small" :icon="buttonIconName" @click="clickTrigger">
                {{ buttonText }}
            </nue-button>
        </template>
        <template #dropdown>
            <nue-div class="nue-dropdown-item" @click="handleSelect">
                <nue-icon name="inbox" size="12px" />
                <nue-text size="12px" style="flex: auto">收集箱</nue-text>
                <nue-icon v-if="projectId === userId" name="check" />
            </nue-div>
            <nue-divider />
            <nue-div
                v-for="(project, index) in projects"
                :key="index"
                class="nue-dropdown-item"
                :data-selected="project.id === projectId"
                @click="handleSelect(project.id, project.title)"
            >
                <nue-icon name="more2" size="12px" />
                <nue-text size="12px" style="flex: auto">{{ project.title }}</nue-text>
                <nue-icon v-if="project.id === projectId" name="check" />
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@nao-todo/types'

defineOptions({ name: 'TodoProjectSelector' })
const props = defineProps<{
    userId: Project['userId']
    projects: Project[]
    projectId?: Project['id']
    placeholder?: string
}>()
const emit = defineEmits<{
    (event: 'select', projectId: Project['id'], projectTitle: Project['title']): void
}>()

const buttonIconName = computed(() => {
    const { projectId, userId } = props
    if (projectId === '') return 'switch'
    return projectId !== userId ? 'more2' : 'inbox'
})

const buttonText = computed(() => {
    const { projectId, placeholder } = props
    const projectTitle = props.projects.find((project) => project.id === projectId)?.title
    if (projectId === '') return placeholder || '移动到'
    return projectTitle || '收集箱'
})

const handleSelect = async (projectId?: Project['id'], projectTitle?: Project['title']) => {
    if (projectId && projectTitle) {
        emit('select', projectId, projectTitle)
        return
    }
    emit('select', props.userId, '收集箱')
}
</script>
