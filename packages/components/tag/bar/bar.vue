<template>
    <nue-div class="tag-bar" gap="12px">
        <tag-node
            v-for="(tag, index) in tags"
            :key="index"
            :tag="tag"
            @delete="handleDeleteTag"
        ></tag-node>
    </nue-div>
</template>

<script setup lang="ts">
import type { Tag } from '@nao-todo/types'
import { TagNode } from '../node'
import type { TagBarProps, TagBarEmits } from './types'

defineOptions({ name: 'TagBar' })
defineProps<TagBarProps>()
const emit = defineEmits<TagBarEmits>()

const handleDeleteTag = (tagId: Tag['id']) => {
    emit('delete-tag', tagId)
}
</script>

<style scoped></style>
