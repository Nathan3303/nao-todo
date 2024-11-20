<template>
    <nue-div class="tag-bar" gap="12px">
        <tag-node v-for="(tag, index) in tags" :key="index" :tag="tag" @delete="handleDeleteTag" />
    </nue-div>
</template>

<script setup lang="ts">
import { TagNode } from '../node'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagBar' })
defineProps<{
    tags: Tag[]
    readonly?: boolean
}>()
const emit = defineEmits<{
    (event: 'delete-tag', tagId: Tag['id']): void
}>()

const handleDeleteTag = (tagId: Tag['id']) => {
    emit('delete-tag', tagId)
}
</script>
