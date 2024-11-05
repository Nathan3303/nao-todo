<template>
    <nue-tooltip size="small" :content="tooltipContent">
        <nue-button
            class="project-delete-button"
            :theme="$slots.default ? 'small' : 'pure'"
            :icon="iconName"
            @click.stop="handleClick"
        >
            <slot />
        </nue-button>
    </nue-tooltip>
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

const tooltipContent = computed(() => {
    const { isDeleted } = props
    return isDeleted ? '恢复清单' : '删除清单'
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
