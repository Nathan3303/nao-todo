<template>
    <nue-button
        class="project-delete-button"
        theme="pure"
        :icon="iconName"
        @click.stop="handleClick"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'ProjectDeleteButton' })
const props = defineProps<{ isDeleted?: boolean }>()
const emit = defineEmits<{
    (event: 'delete'): void
    (event: 'resotre'): void
}>()

const iconName = computed(() => {
    const { isDeleted } = props
    return isDeleted ? 'restore' : 'delete'
})

const handleClick = () => {
    if (props.isDeleted) {
        emit('resotre')
    } else {
        emit('delete')
    }
}
</script>

<style scoped>
.project-delete-button {
    --icon-size: 16px;
    --icon-weight: normal;
    cursor: pointer;
    transition: all 0.16s;
}
</style>
