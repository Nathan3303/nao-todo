<template>
    <nue-div class="todo-tag-details">
        <tag-node v-for="tag in tags" :key="tag.id" :tag="tag" @delete="handleDropTag" />
        <combo-box trigger-title="标签" :framework="unusedTagOptions" @change="handleAddTag" />
    </nue-div>
</template>

<script setup lang="ts">
import { TagNode, ComboBox } from '@/components'
import { useTagStore } from '@/stores'
import { computed, ref } from 'vue'
import type { Todo, Tag } from '@/stores'
import type { UnusedTagOption } from './types'

defineOptions({ name: 'TodoTagDetails' })
const props = defineProps<{ todoId: Todo['id']; todoTags: Todo['tags'] }>()
const emit = defineEmits<{ (event: 'updateTags', tags: Todo['tags']): void }>()

const tagStore = useTagStore()

const unusedTagOptions = ref<UnusedTagOption[]>([])

const tags = computed<Todo['tagsInfo']>(() => {
    const tags = props.todoTags
    const _tags: Tag[] = []
    if (tags) {
        unusedTagOptions.value = []
        tagStore.tags.map((tag) => {
            if (tags.includes(tag.id)) {
                _tags.push(tag)
            } else {
                unusedTagOptions.value.push({
                    label: tag.name,
                    value: tag.id
                })
            }
        })
    }
    return _tags
})

const handleAddTag = async (tagId: unknown) => {
    const newTags = tags.value.map((tag) => tag.id)
    newTags.push(tagId as Tag['id'])
    emit('updateTags', newTags as Todo['tags'])
}

const handleDropTag = async (tagId: Tag['id']) => {
    const newTags = tags.value.map((tag) => {
        if (tag.id !== tagId) return tag.id
    })
    emit('updateTags', newTags as Todo['tags'])
}
</script>

<style scoped>
@import url('./tag-details.css');
</style>
