<template>
    <div class="overview-wrapper">
        <nue-div class="pinned-tasks" vertical theme="card">
            <nue-text>收藏的任务</nue-text>
            <nue-divider></nue-divider>
            <nue-div>
                <empty :empty="!todos.length" message="没有收藏的任务" full-height>
                    <todo-table
                        :todos="todos"
                        :columns="columns"
                        simple
                        @show-todo-details="handleShowTodoDetails"
                    ></todo-table>
                </empty>
            </nue-div>
        </nue-div>
        <nue-div class="state-overview" vertical theme="card">
            <nue-text>状态计数</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical gap="12px">
                <state-row icon="circle" title="待办" :count="countInfo.byState.todo"></state-row>
                <state-row
                    icon="in-progress"
                    title="正在进行"
                    :count="countInfo.byState['in-progress']"
                ></state-row>
                <state-row
                    icon="success"
                    title="已完成"
                    :count="countInfo.byState.done"
                ></state-row>
            </nue-div>
        </nue-div>
        <nue-div class="third-block" vertical theme="card">
            <nue-text>任务分析</nue-text>
            <nue-divider></nue-divider>
        </nue-div>
        <nue-div class="fourth-block" vertical theme="card">
            <nue-text>项目详情</nue-text>
            <nue-divider></nue-divider>
            <project-details :project="project" />
        </nue-div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ProjectDetails, TodoTable, Empty, type Columns } from '@/components'
import StateRow from './state-row.vue'
import { useRouter } from 'vue-router'
import type { ProjectsMainOverviewProps } from './types'

const props = defineProps<ProjectsMainOverviewProps>()

const router = useRouter()
const todoStore = useTodoStore()
const userStore = useUserStore()

const { todos, filterInfo } = storeToRefs(todoStore)
const { countInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const columns = ref<Columns>({
    createdAt: false,
    updatedAt: false,
    priority: true,
    state: true,
    description: false
})

await todoStore.getTodosByFilterInfo(user.value!.id, {
    isPinned: true,
    projectId: props.project!.id
})

const handleShowTodoDetails = async (id: string) => {
    filterInfo.value.id = id
    router.push({ name: 'project-main-table' })
}
</script>

<style scoped>
@import url('./overview.css');
</style>
