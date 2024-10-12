<template>
    <nue-div class="todo-creator-wrapper" vertical align="stretch">
        <nue-input v-model="todoData.name" placeholder="待办事项名称" clearable />
        <nue-checkbox v-model="setMoreData" size="small">设置更多</nue-checkbox>
        <nue-divider v-if="setMoreData" />
        <nue-div v-if="setMoreData" vertical align="stretch">
            <nue-div align="center" justify="space-between">
                <nue-text>更多设置</nue-text>
                <nue-button theme="pure" size="small" @click="handleClearData">清除设置</nue-button>
            </nue-div>
            <nue-div align="center" gap="0px">
                <nue-text size="12px">任务过期时间：</nue-text>
                <todo-date-selector v-model="endDate" />
            </nue-div>
            <nue-div wrap="nowrap">
                <todo-selector
                    :value="todoData.priority"
                    :options="[
                        { label: '低', value: 'low' },
                        { label: '中', value: 'medium' },
                        { label: '高', value: 'high' }
                    ]"
                    @change="(p) => (todoData.priority = p as string)"
                />
                <todo-selector
                    :value="todoData.state"
                    :options="[
                        { label: '代办', value: 'todo' },
                        { label: '正在进行', value: 'in-progress' },
                        { label: '已完成', value: 'done' }
                    ]"
                    @change="(s) => (todoData.state = s as string)"
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
            <todo-tag-bar :tags="tags" :todo-tags="todoData.tags" @update-tags="handleUpdateTags" />
            <nue-textarea v-model="todoData.description" placeholder="添加待办事项备注" :rows="4" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import TodoDateSelector from '../date-selector/date-selector.vue'
import TodoSelector from '../selector/selector.vue'
import TodoTagBar from '../tag-bar/tag-bar.vue'
import TodoProjectSelector from '../project-selector/project-selector.vue'
import type { TodoCreatorProps, TodoCreatorEmits } from './types'

defineOptions({ name: 'TodoCreator' })
const props = defineProps<TodoCreatorProps>()
const emit = defineEmits<TodoCreatorEmits>()

const setMoreData = ref(!!props.presetInfo)
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
        const sliced = todoData.dueDate.endAt!.slice(0, 16)
        // console.log(sliced)
        return sliced
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
