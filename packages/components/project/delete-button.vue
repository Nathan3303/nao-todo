<script setup lang="ts">
type ProjectDeleteButtonProps = {
    isDeleted?: boolean
}
type ProjectDeleteButtonEmits = {
    (event: 'delete'): void
    (event: 'restore'): void
}

defineOptions({ name: 'ProjectDeleteButton' })
const props = defineProps<ProjectDeleteButtonProps>()
const emit = defineEmits<ProjectDeleteButtonEmits>()

const handleClick = () => {
    if (props.isDeleted) {
        emit('restore')
        return
    }
    emit('delete')
}
</script>

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

<style scoped>
.project-delete-button {
    --nue-button-font-size: var(--nue-text-df);
    cursor: pointer;
    transition: all 0.16s;
}
</style>

