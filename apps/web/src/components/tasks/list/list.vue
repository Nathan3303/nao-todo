<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, computed } from 'vue'
import { useTodoList } from './use-list'
import TodoListMain from './list-main.vue'
import { Loading as LoadingComp } from '@/components/ui'
import { TODO_LIST_CONTEXT_KEY } from './constants'
import type { TodoListEmits, TodoListProps, TodoListContext } from './types'
import './list.css'

defineOptions({ name: 'TodoList' })
const props = defineProps<TodoListProps>()
const emit = defineEmits<TodoListEmits>()

// @hook useTodoList
const {
    tags,
    error,
    todos,
    loading,
    refreshKey,
    selectRange,
    tagBarClamped,
    infiniteScrollDisabled,
    loadMore,
    clearTodos,
    stopRefresh,
    startRefresh,
    getColumnText,
    isTodoExpired,
    getProjectName,
    handleClearSelect,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    handleClearSelectedId,
    deleteButtonClickHandler
} = useTodoList(props, emit)

// @mounted
onMounted(() => {
    clearTodos()
    startRefresh()
})

// @beforeUnmounted
onBeforeUnmount(() => {
    stopRefresh()
})

// @provide 表格组件上下文
provide<TodoListContext>(TODO_LIST_CONTEXT_KEY, {
    tags: computed(() => tags.value),
    todos: computed(() => todos.value),
    columns: computed(() => props.columns),
    refreshKey: computed(() => refreshKey.value),
    selectRange,
    sortOptions: computed(() => props.sortOptions),
    tagBarClamped,
    getColumnText,
    isTodoExpired,
    getProjectName,
    clearSortOptions: () => emit('clearSortOptions'),
    updateSortOptions: (newSortOptions) => emit('updateSortOptions', newSortOptions),
    showTodoDetailsPanel,
    showMultiSelectPanel,
    deleteButtonClickHandler
})

// @expose 表格组件暴露的方法
defineExpose({
    reset: handleClearSelectedId,
    resetSelect: handleClearSelect
})
</script>

<template>
    <nue-container id="TodoListContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="error && todos.length === 0"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    :description="error"
                    style="height: 100%"
                />
                <nue-infinite-scroll
                    v-else
                    @load-more="loadMore"
                    :loading="loading"
                    :disabled="infiniteScrollDisabled"
                    trigger-height="2px"
                >
                    <todo-list-main />
                    <template #loading>
                        <loading-comp placeholder="正在加载待办任务..." />
                    </template>
                    <template #disabled>
                        <nue-empty
                            theme="no-image"
                            :description="`${todos.length} 条待办任务已全部加载完成`"
                        />
                    </template>
                </nue-infinite-scroll>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
