<template>
    <nue-tooltip size="small" :content="tooltipContent">
        <nue-button
            class="project-archive-button"
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

const tooltipContent = computed(() => {
    const { isArchived } = props
    return isArchived ? '取消归档清单' : '归档清单'
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
