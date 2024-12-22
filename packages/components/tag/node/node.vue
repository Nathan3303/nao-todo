<template>
    <nue-div :class="classes" :style="styles">
        <span class="tag-node__name">{{ tag.name }}</span>
        <nue-icon
            v-if="!readonly"
            class="tag-node__delete-button"
            name="clear"
            @click="handleDelete(tag.id)"
        />
    </nue-div>
</template>

<style scoped src="./node.css" />

<script lang="ts">
type TagNodeProps = {
    tag: { id: string; name: string; color: string }
    deletable?: boolean
    readonly?: boolean
}
type TagNodeEmits = {
    (event: 'delete', id: string): void
}
</script>

<script lang="ts" setup>
import { computed } from 'vue'

defineOptions({ name: 'TagNode' })
const props = defineProps<TagNodeProps>()
const emit = defineEmits<TagNodeEmits>()

const classes = computed(() => {
    return ['tag-node', { 'tag-node--transparent': props.tag.color === 'transparent' }]
})

const styles = computed(() => {
    return {
        '--tag-node-bg': props.tag.color || '#f5f5f5'
    }
})

const handleDelete = (id: string) => {
    emit('delete', id)
}
</script>
