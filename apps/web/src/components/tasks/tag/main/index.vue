<script setup lang="ts">
import { computed } from 'vue'
import { inject, onMounted, onUnmounted } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { TagHandler } from '@/infrastructure/handlers/tag'
import { TAG_EMPTY_STATE } from '../constants'
import {
    TableViewAdapter,
    ListViewAdapter,
    KanbanViewAdapter,
    type ViewAdapterNoTaskError
} from '@/layouts/app/view-adapters'
import { TAG_VIEW_CONTEXT_KEY } from '../context'

defineOptions({
    name: 'TasksMainTagContent',
    components: {
        'table-view': TableViewAdapter,
        'list-view': ListViewAdapter,
        'kanban-view': KanbanViewAdapter
    }
})
const props = defineProps<{ viewType: string }>()

// @viewContext
const {
    taskUseCase,
    preference,
    subscriber,
    tags,
    getColumnLabel,
    getProjectName,
    showTaskDetails,
    tagHandler,
    tag
} = inject(TAG_VIEW_CONTEXT_KEY)!

// @computed 组件名称
const componentName = computed(() => `${props.viewType || 'table'}-view`)

// Handlers 代理
const updateColumns: TagHandler['updateColumns'] = (k, v) => {
    return tagHandler.updateColumns(k, v)
}

// Handlers 代理
const updateSortOptions: TagHandler['updateSortOption'] = (f, o) => {
    return tagHandler.updateSortOption(f, o)
}

// @method 更新偏好设置
const updatePreferenceHandler = async () => {
    if (!tag.value) return NueMessage.error('标签不存在')
    const err = await tagHandler.savePreference(tag.value!.id)
    if (err !== null) return NueMessage.error(unwrapError(err))
    NueMessage.success('保存成功')
}

// @onMounted
onMounted(() => {
    subscriber.subscribe('UpdatePreference', updatePreferenceHandler)
})

// @onUnmounted
onUnmounted(() => {
    subscriber.unsubscribe('UpdatePreference', updatePreferenceHandler)
})

// @method 获取空状态信息
const getNoTaskError = (): ViewAdapterNoTaskError | undefined => {
    if (!tag.value) return undefined
    return TAG_EMPTY_STATE
}
</script>

<template>
    <nue-main>
        <nue-content fill overflow="hidden">
            <component
                :is="componentName"
                :task-use-case="taskUseCase"
                :get-tasks-options="preference!.getTasksOptions"
                :subscriber="subscriber"
                :tags="tags"
                :columns="preference!.columns"
                :get-column-label="getColumnLabel"
                :get-project-name="getProjectName"
                :show-task-details="showTaskDetails"
                :update-columns="updateColumns"
                :update-sort-options="updateSortOptions"
                :clear-sort-options="() => tagHandler.clearSortOption()"
                :get-no-task-error="getNoTaskError"
            />
        </nue-content>
    </nue-main>
</template>

