<template>
    <nue-button
        class="project-archive-button"
        theme="pure"
        :icon="iconName"
        @click.stop="handleClick"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'ProjectArchiveButton' })
const props = defineProps<{ isArchived?: boolean }>()
const emit = defineEmits<{
    (event: 'archive'): void
    (event: 'unarchive'): void
}>()

const iconName = computed(() => {
    const { isArchived } = props
    return isArchived ? 'unarchive' : 'archive'
})

const handleClick = () => {
    if (props.isArchived) {
        emit('unarchive')
    } else {
        emit('archive')
    }
}
</script>

<style scoped>
.project-archive-button {
    --icon-size: 16px;
    --icon-weight: normal;
    cursor: pointer;
    transition: all 0.16s;
}
</style>
