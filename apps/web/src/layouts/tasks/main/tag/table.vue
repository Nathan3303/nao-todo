<script setup lang="ts">
import { ref, watchEffect, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@nao-todo/components'
import { unwrapError } from '@nao-todo/utils'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TasksMainTagViewTable' })

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()
const router = useRouter()

const { viewProps } = storeToRefs(tasksViewStore)
const { todos, pagination, tags } = storeToRefs(tasksDataStore)
const iTagId = ref<Tag['id']>()
const loading = ref<boolean>(false)
const error = ref<string>('')
const page = ref<number>(1)

const showTodoDetails = (id: string) => {
    router.push({ name: 'tasks-tag', params: { todoId: id as string } })
}

const handleChangePerpage = (limit: number) => {
    if (!viewProps.value) return
    viewProps.value.preference.getTodosOptions.limit = limit
}

watchEffect(async () => {
    // 判断 viewProps
    if (!viewProps.value) return
    // 判断标签 Id 是否相同
    if (iTagId.value === viewProps.value.id) return
    // 重置加载状态
    loading.value = true
    error.value = ''
    // 保存标签偏好（记录在标签数据中，以便偏好更新时直接传输）
    viewProps.value.preference.getTodosOptions = {
        limit: 20,
        tagId: viewProps.value.id,
        ...viewProps.value.preference.getTodosOptions
    }
    // 调用 API 请求数据
    const err = await tasksDataStore.getTodos({
        ...viewProps.value.preference.getTodosOptions,
        page: page.value
    })
    loading.value = false
    // 记录已请求的标签 Id，避免重复请求
    iTagId.value = viewProps.value.id
    // 处理失败结果
    if (err) {
        error.value = unwrapError(err)
        return
    }
})

watch(
    () => todos.value,
    (newVal) => {
        // 判断待办结果是否为空
        if (newVal.length === 0) {
            error.value = '当前暂无待办'
            return
        }
        // 处理成功结果
        error.value = ''
    },
    { deep: true, immediate: true }
)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <loading-comp v-if="loading" />
        <nue-empty
            v-else-if="error || !viewProps"
            image-size="4rem"
            image-src="/images/coffee.webp"
            :description="error"
            style="height: 100%"
        />
        <nue-main v-else>
            <nue-content fill>
                <todo-table
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort!"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="showTodoDetails"
                />
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-div v-if="pagination" align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ pagination.limit || 0 }} 项， 共计 {{ pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :limit="pagination.limit"
                    :page="pagination.page"
                    :total-pages="pagination.maxPage"
                    @per-page-change="handleChangePerpage"
                    @page-change="(p) => (page = p)"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainTableContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>
