<script lang="ts" setup>
import { watchEffect, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { CommentRow, Loading as LoadingComp } from '@nao-todo/components'
import { unwrapError } from '@nao-todo/utils'
import { NueMessage } from 'nue-ui'
import type { Todo, Comment } from '@nao-todo/types'

const props = defineProps<{ todoId: Todo['id'] }>()

const tasksDataStore = useTasksDataStore()

const { comments } = storeToRefs(tasksDataStore)
const loading = ref(false)
const error = ref('')

const handleEditComment = async (id: Comment['id'], newContent: Comment['content']) => {
    const err = await tasksDataStore.updateComment(id, { content: newContent })
    return !err
}

const handleDeleteComment = async (id: Comment['id']) => {
    const err = await tasksDataStore.deleteComment(id)
    if (err) {
        NueMessage.error('评论删除失败')
        return
    }
    NueMessage.success('评论删除成功')
}

watchEffect(() => {
    // 处理与弹出层动画冲突导致卡顿
    setTimeout(async () => {
        // 获取待办任务 Id
        const todoId = props.todoId
        // 重置加载状态
        loading.value = true
        // 获取检查事项
        const err = await tasksDataStore.getComments({ todoId })
        loading.value = false
        // 处理失败结果
        if (err) {
            error.value = unwrapError(err)
            return
        }
        error.value = ''
    }, 320)
})
</script>

<template>
    <loading-comp v-if="loading" />
    <nue-div
        v-else-if="comments.length"
        style="border-top: 1px solid var(--nue-divider-color); padding: 8px"
    >
        <nue-div vertical gap="0">
            <nue-div style="padding: 8px">
                <nue-text size="14px" :weight="500">评论</nue-text>
                <nue-text size="14px" color="gray">{{ comments.length }}</nue-text>
            </nue-div>
            <nue-div vertical gap="0.75rem" style="padding: 8px 0">
                <comment-row
                    v-for="comment in comments"
                    :key="comment.id"
                    :comment="comment"
                    :updater="handleEditComment"
                    @delete="handleDeleteComment"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
