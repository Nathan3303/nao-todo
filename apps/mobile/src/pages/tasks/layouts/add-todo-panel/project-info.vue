<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from '@/ui/icon.vue'
import { useProjectStore } from '@/pages/tasks/stores/project'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoProjectInfo' })
const props = defineProps<{ projectId?: Todo['projectId'] }>()

const projectStore = useProjectStore()

const info = computed(() => {
    if (!props.projectId) return ['inbox', '收集箱']
    const p = projectStore.getProjectByIdFromLocal(props.projectId)
    if (!p) return ['inbox', '收集箱']
    return ['more2', p.title]
})
</script>

<template>
    <view class="todo-state-info">
        <nuem-icon :name="info[0]" />
        <text v-if="info[1]">{{ info[1] }}</text>
    </view>
</template>

<style scoped>
.todo-state-info {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    --icon-size: var(--text-md);
    --icon-color: var(--primary-color-700);
    font-size: var(--text-xs);
}
</style>
