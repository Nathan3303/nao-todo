<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useTodoStore } from '@/pages/tasks/stores/todo'
import { useTagStore } from '@/pages/tasks/stores/tag'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import { storeToRefs } from 'pinia'
import type { Tag } from '@nao-todo/types'
import NuemButton from '@/ui/button.vue'

defineOptions({ name: 'TodoTags' })

const todoStore = useTodoStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const { todoDetailsId } = storeToRefs(tasksViewStore)
const { tags } = storeToRefs(tagStore)

const usedTags = ref<Tag[]>([])
const unUsedTags = ref<Tag[]>([])

const getTags = async () => {
    if (!todoDetailsId.value) return
    usedTags.value = []
    unUsedTags.value = []
    const todoTags = todoStore.getTodoByIdFromLocal(todoDetailsId.value)?.tags || []
    tags.value.forEach((tag) => {
        if (todoTags.includes(tag.id)) {
            usedTags.value.push(tag)
        } else {
            unUsedTags.value.push(tag)
        }
    })
    console.log(usedTags.value, unUsedTags.value)
}

watch(
    () => todoDetailsId.value,
    () => getTags(),
    { immediate: true }
)
</script>

<template>
    <view class="todo-tags">
        <wd-tag v-for="tag in usedTags" :key="tag.id" :bg-color="tag.color" color="white" round>
            {{ tag.name }}
        </wd-tag>
        <nuem-button icon="plus" theme="sm">添加标签</nuem-button>
    </view>
</template>

<style scoped>
.todo-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-height: 36px;
    padding: 0.25rem 0;
    gap: 0.5rem;
}
</style>
