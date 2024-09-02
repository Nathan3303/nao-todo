<template>
    <nue-div class="todo-tag-details">
        <!-- <tag-node v-for="tag in tags" :key="tag.id" :tag="tag" @delete="handleDeleteTag"></tag-node> -->
        <combo-box
            trigger-title="标签"
            :framework="unusedTagOptions"
            @change="handleAddTag"
        ></combo-box>
    </nue-div>
</template>

<script setup lang="ts">
import { TagBar, TagNode, ComboBox } from '@/components'
import { useTodoStore, useTagStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import type { Todo, Tag } from '@/stores'
import type { UnusedTagOption } from './types'

defineOptions({ name: 'TodoTagDetails' })

const todoStore = useTodoStore()
const tagStore = useTagStore()
const userStore = useUserStore()

// const { todo } = storeToRefs(todoStore)
const unusedTagOptions = ref<UnusedTagOption[]>([])

// const tags = computed<Todo['tagsInfo']>(() => {
//     const tags = todo.value?.tags
//     const _tags: Tag[] = []
//     if (tags) {
//         unusedTagOptions.value = []
//         tagStore.tags.map((tag) => {
//             if (tags.includes(tag.id)) {
//                 _tags.push(tag)
//             } else {
//                 unusedTagOptions.value.push({
//                     label: tag.name,
//                     value: tag.id
//                 })
//             }
//         })
//     }
//     return _tags
// })

const handleDeleteTag = async (tagId: Tag['id']) => {
    // console.log(tagId)
    // await todoStore.removeTag(userStore.user!.id, todo.value!.id, tagId)
}

const handleAddTag = async (tagId: unknown) => {
    // await todoStore.addTag(userStore.user!.id, todo.value!.id, tagId as Tag['id'])
}
</script>

<style scoped>
@import url('./tag-details.css');
</style>
