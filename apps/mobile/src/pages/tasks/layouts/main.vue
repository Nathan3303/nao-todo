<template>
    <view class="tasks-view__main">
        <view v-if="loading" class="tasks-view__main__loading">
            <text>加载中...</text>
        </view>
        <todo-table v-else></todo-table>
    </view>
</template>

<script lang="ts" setup>
import TodoTable from './todo-table/index.vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '../stores/view'

defineOptions({ name: 'TasksTable' })

const tasksViewStore = useTasksViewStore()

const { loading } = storeToRefs(tasksViewStore)
</script>

<style scoped>
.tasks-view__main {
    flex: 1 1 auto;
    overflow: hidden;
}
</style>
