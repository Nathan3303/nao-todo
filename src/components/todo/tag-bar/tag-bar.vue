<template>
    <nue-div class="todo-tag-bar">
        <tag-node v-for="tag in tags" :key="tag.id" :tag="tag" @delete="handleDropTag" />
        <combo-box trigger-title="标签" :framework="unusedTagOptions" @change="handleAddTag" />
    </nue-div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TagNode from '@/components/tag/node/node.vue'
import ComboBox from '@/components/general/combo-box/combo-box.vue'
import type { TodoTagBarProps, TodoTagBarEmits } from './types'
import type { FrameworkOption } from '@/components/general/combo-box/types'

defineOptions({ name: 'TodoTagBar' })
const props = defineProps<TodoTagBarProps>()
const emit = defineEmits<TodoTagBarEmits>()

const unusedTagOptions = ref<FrameworkOption[]>([])

const tags = computed<typeof props.tags>(() => {
    const { tags: globalTags, todoTags } = props
    const _tags: typeof props.tags = []
    if (globalTags) {
        unusedTagOptions.value = []
        globalTags.map((tag) => {
            if (todoTags.includes(tag.id)) {
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
    newTags.push(tagId as string)
    emit('updateTags', newTags)
}

const handleDropTag = async (tagId: string) => {
    const newTags = tags.value.map((tag) => {
        if (tag.id && tag.id !== tagId) {
            return tag.id
        }
    })
    emit('updateTags', newTags as string[])
}
</script>

<style scoped>
.todo-tag-bar {
    align-items: center;
    gap: 12px;
}
</style>
