<template>
    <nue-div class="todo-creator-wrapper" vertical align="stretch">
        <nue-input v-model="todoData.name" placeholder="待办事项名称" clearable />
        <nue-div v-if="setMoreData" vertical align="stretch">
            <nue-div align="center">
                <todo-date-selector v-model="endDate" />
                <nue-text v-if="endDate" size="12px" color="gray">
                    ( {{ useRelativeDate(endDate) }} )
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap">
                <todo-selector
                    :value="todoData.state"
                    :options="TodoStateSelectOptions"
                    @change="(s) => (todoData.state = s as string)"
                />
                <todo-selector
                    :value="todoData.priority"
                    :options="TodoPrioritySelectOptions"
                    @change="(p) => (todoData.priority = p as string)"
                />
                <nue-div flex></nue-div>
                <todo-project-selector
                    :user-id="userId"
                    :projects="projects"
                    :project-id="todoData.projectId"
                    :project-title="todoData.project.title"
                    @select="setProjectInfo"
                />
            </nue-div>
            <todo-tag-bar
                :tags="tags"
                :todo-tags="todoData.tags"
                :clamped="5"
                @update-tags="handleUpdateTags"
            />
            <nue-textarea v-model="todoData.description" placeholder="添加待办事项备注" :rows="4" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import TodoDateSelector from '../date-selector/date-selector.vue'
import { TodoPrioritySelectOptions, TodoSelector, TodoStateSelectOptions } from '../selector'
import TodoTagBar from '../tag-bar/tag-bar.vue'
import TodoProjectSelector from '../project-selector/project-selector.vue'
import { useRelativeDate } from '@nao-todo/hooks/use-relative-date'
import type { TodoCreatorEmits, TodoCreatorProps } from './types'

defineOptions({ name: 'TodoCreator' })
const props = defineProps<TodoCreatorProps>()
defineEmits<TodoCreatorEmits>()

const setMoreData = ref(true)
const todoData = reactive({
    name: '',
    dueDate: { endAt: '' },
    priority: 'low',
    state: 'todo',
    projectId: '',
    project: { title: '' },
    description: '',
    tags: [],
    ...props.presetInfo
})

const endDate = computed({
    get() {
        if (!todoData.dueDate.endAt) return ''
        return todoData.dueDate.endAt!.slice(0, 16)
    },
    set(value) {
        todoData.dueDate.endAt = value
    }
})

const setProjectInfo = (projectId: string, projectTitle: string) => {
    todoData.projectId = projectId
    todoData.project.title = projectTitle
}

const handleUpdateTags = (tags: string[]) => {
    todoData.tags = tags
}

const handleClearData = () => {
    todoData.dueDate = { endAt: '' }
    todoData.priority = 'low'
    todoData.state = 'todo'
    todoData.projectId = ''
    todoData.project.title = ''
    todoData.description = ''
    todoData.tags = []
}

defineExpose({
    todoData,
    clear: handleClearData
})
</script>

<style scoped></style>
