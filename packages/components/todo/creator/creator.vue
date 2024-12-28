<template>
    <nue-div align="stretch" class="todo-creator-wrapper" vertical>
        <nue-input v-model="todoData.name" clearable placeholder="待办事项名称" />
        <nue-div v-if="setMoreData" align="stretch" vertical>
            <nue-div wrap="nowrap" gap="8px">
                <todo-selector
                    :options="TodoStateSelectOptions"
                    :value="todoData.state"
                    @change="(s) => (todoData.state = s as CreateTodoOptions['state'])"
                />
                <todo-selector
                    :options="TodoPrioritySelectOptions"
                    :value="todoData.priority"
                    @change="(p) => (todoData.priority = p as CreateTodoOptions['priority'])"
                />
                <nue-div flex />
                <todo-project-selector
                    :project-id="todoData.projectId"
                    :projects="projects"
                    :user-id="userId"
                    @select="setProjectInfo"
                />
            </nue-div>
            <nue-div align="center">
                <todo-date-selector v-model="todoData.dueDate.endAt" />
                <nue-text v-if="todoData.dueDate.endAt" color="gray" size="12px">
                    {{ useRelativeDate(todoData.dueDate.endAt) }}
                </nue-text>
            </nue-div>
            <todo-tag-bar
                :clamped="5"
                :tags="tags"
                :todo-tags="todoData.tags!"
                @update-tags="handleUpdateTags"
            />
            <nue-textarea
                v-model="todoData.description"
                :rows="4"
                placeholder="添加待办事项备注（可选）"
            />
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { TodoDateSelector, TodoProjectSelector, TodoTagBar } from '@nao-todo/components'
import { TodoPrioritySelectOptions, TodoSelector, TodoStateSelectOptions } from '../selector'
import { useRelativeDate } from '@nao-todo/hooks/use-relative-date'
import type { CreateTodoOptions } from '@nao-todo/types'
import type { TodoCreatorProps } from './types'

defineOptions({ name: 'TodoCreator' })
const props = defineProps<TodoCreatorProps>()

const setMoreData = ref(true)
const todoData = reactive<CreateTodoOptions>({
    name: '',
    dueDate: { endAt: null },
    priority: 'low',
    state: 'todo',
    projectId: '',
    description: '',
    tags: [],
    ...props.presetInfo
})

const setProjectInfo = (projectId: string) => {
    todoData.projectId = projectId
}

const handleUpdateTags = (tags: string[]) => {
    todoData.tags = tags
}

const handleClearData = () => {
    todoData.name = ''
    todoData.dueDate = { endAt: '' }
    todoData.priority = 'low'
    todoData.state = 'todo'
    todoData.projectId = ''
    todoData.description = ''
    todoData.tags = []
}

defineExpose({
    todoData,
    clear: handleClearData
})
</script>
