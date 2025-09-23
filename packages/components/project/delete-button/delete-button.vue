<template>
    <nue-tooltip size="small" :content="isDeleted ? '恢复清单' : '删除清单'">
        <nue-button
            class="project-delete-button"
            :theme="$slots.default ? 'icon,ghost,small' : 'icon,ghost,pure'"
            :icon="isDeleted ? 'restore' : 'delete'"
            @click.stop="handleClick"
        >
            <slot />
        </nue-button>
    </nue-tooltip>
</template>

<script setup lang="ts">
defineOptions({ name: 'ProjectDeleteButton' })
const props = defineProps<{
    isDeleted?: boolean
}>()
const emit = defineEmits<{
    (event: 'delete'): void
    (event: 'restore'): void
}>()

const handleClick = () => {
    if (props.isDeleted) {
        emit('restore')
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
