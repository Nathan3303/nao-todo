<template>
    <content-table
        :key="route.params.tagId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-tag-table"
        :columns="columns"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import { useRoute } from 'vue-router'
import type { Todo, TodoFilter } from '@/stores'
import type { Columns } from '@/components'
import { NueMessage } from 'nue-ui'

const route = useRoute()
const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo = computed<TodoFilter>(() => {
    const tagId = route.params.tagId as string
    return {
        isDeleted: false,
        tagId
    }
})

const columns: Columns = {
    createdAt: false,
    updatedAt: false,
    endAt: true,
    priority: true,
    state: true,
    description: true,
    project: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const tagId = route.params.tagId as string
    const projectId = userStore.user!.id
    const userId = userStore.user!.id
    const newTodo: Partial<Todo> = {
        userId,
        projectId: projectId,
        tags: [tagId],
        name: todoName
    }
    const res = await todoStore.create(userId, newTodo)
    if (res.code === '20000') {
        await todoStore.get(userId)
        NueMessage.success('任务创建成功')
    }
}
</script>

<style scoped></style>
