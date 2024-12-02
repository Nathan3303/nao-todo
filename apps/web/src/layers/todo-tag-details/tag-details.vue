<template>
    <todo-tag-bar :tags="tagStore.tags" :todoTags="todoTags" />
</template>

<script lang="ts" setup>
import { useTagStore } from '@/stores'
import { TodoTagBar } from '@nao-todo/components'
import type { TodoTagDetailsProps, TodoTagDetailsEmits } from './types'

defineOptions({ name: 'TodoTagDetails' })
defineProps<TodoTagDetailsProps>()
defineEmits<TodoTagDetailsEmits>()

const tagStore = useTagStore()
</script>

<style scoped>
.todo-tag-details {
    align-items: center;
    gap: 12px;
}
</style>
