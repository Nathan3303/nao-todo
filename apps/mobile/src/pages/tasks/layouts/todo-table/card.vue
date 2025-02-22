<template>
    <view v-if="todo" class="todo-card" @click.stop="emit('showTodoDetails', todo.id)">
        <view class="todo-card__title-bar">
            <view class="todo-card__title-bar__title text--clamped">
                {{ todo.name }}
            </view>
            <view v-if="tags.length" class="todo-card__title-bar__tags">
                <wd-tag v-for="tag in tags" :key="tag.id" :bg-color="tag.color">
                    {{ tag.name }}
                </wd-tag>
            </view>
        </view>
        <view class="todo-card__description">
            {{ todo.description }}
        </view>
        <view class="todo-card__details">
            <text class="todo-card__details__item todo-card__updated-at">
                {{ useRelativeDate(todo.updatedAt) }}
            </text>
            <text class="todo-card__details__item todo-card__end-at">
                {{ useRelativeDate(todo.dueDate.endAt) }}
            </text>
            <text class="todo-card__details__item todo-card__priority">
                <nuem-icon name="priority-1" />
                <text>低优先级</text>
            </text>
            <view class="todo-card__details__item todo-card__actions">
                <nuem-icon name="delete" />
            </view>
        </view>
    </view>
    <view v-else class="todo-card--empty">数据无效</view>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from '@/ui/icon.vue'
import { useRelativeDate } from '@nao-todo/hooks'
import { useTagStore } from '@/pages/tasks/stores/tag'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoCard' })
const props = defineProps<{
    todo?: Todo
}>()
const emit = defineEmits<{
    (e: 'showTodoDetails', todoId: Todo['id']): void
}>()

const tagStore = useTagStore()

const tags = computed(() => {
    if (!props.todo) return []
    return props.todo.tags.map((tagId) => tagStore.getTagByIdFromLocal(tagId))
})
</script>

<style scoped>
.todo-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
    padding: 0.75rem;
    background-color: var(--primary-color-100);
    border-radius: var(--primary-radius);
    font-size: 0.75rem;
    color: var(--primary-color-900);
}

.todo-card__title-bar {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 1rem;
}

.todo-card__title-bar__tags {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
}

.todo-card__description {
    color: var(--primary-color-600);
    white-space: break-spaces;
}

.todo-card__details {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.375rem;
}

.todo-card__details__item {
    margin-right: 0.5rem;
}

.todo-card__details__item::before {
    font-size: var(--text-xs);
    color: var(--primary-color-700);
}

.todo-card__created-at::before {
    content: '创建时间：';
}

.todo-card__updated-at::before {
    content: '更新时间：';
}

.todo-card__end-at::before {
    content: '结束时间：';
}

.todo-card__project::before {
    content: '清单：';
}

.todo-card__actions {
    margin-left: auto;
    margin-right: 0;
}

.todo-card--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background-color: var(--primary-color-100);
    border-radius: var(--primary-radius);
    font-size: 0.75rem;
    color: var(--primary-color-700);
}
</style>
