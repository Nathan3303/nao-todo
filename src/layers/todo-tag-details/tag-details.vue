<template>
    <todo-tag-bar :tags="tagStore.tags" :todoTags="todoTags" @update-tags="" />
</template>

<script setup lang="ts">
import { TagNode, ComboBox } from '@/components'
import { useTagStore } from '@/stores'
import { computed, ref } from 'vue'
import { TodoTagBar } from '@/components'
import type { Todo, Tag } from '@/stores'
import type { UnusedTagOption, TodoTagDetailsProps, TodoTagDetailsEmits } from './types'

defineOptions({ name: 'TodoTagDetails' })
const props = defineProps<TodoTagDetailsProps>()
const emit = defineEmits<TodoTagDetailsEmits>()

const tagStore = useTagStore()



const handleAddTag = async (tagId: unknown) => {
    // const newTags = tags.value.map((tag) => tag.id)
    // newTags.push(tagId as Tag['id'])
    const newTags = [...props.todoTags, tagId as Tag['id']]
    emit('updateTags', newTags as Todo['tags'])
}

const handleDropTag = async (tagId: Tag['id']) => {
    // const newTags = tags.value.map((tag) => {
    //     if (tag.id !== tagId) return tag.id
    // })
    const newTags = props.todoTags.filter((id) => id !== tagId)
    emit('updateTags', newTags)
}
</script>

<style scoped>
@import url('./tag-details.css');
</style>
