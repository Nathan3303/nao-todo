<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import { useTodoStore } from '@/pages/tasks/stores/todo'
import NuemButton from '@/ui/button.vue'
import TodoStateInfo from '../add-todo-panel/state-info.vue'
import TodoPriorityInfo from '../add-todo-panel/priority-info.vue'
// import TodoDateInfo from '../add-todo-panel/date-info.vue'
import TodoProjectInfo from '../add-todo-panel/project-info.vue'
import { storeToRefs } from 'pinia'
import type { Project, Todo } from '@nao-todo/types'
import { TodoPriorityOptions, TodoStateOptions } from '@/pages/tasks/constants'
import { useProjectStore } from '@/pages/tasks/stores/project'
import { useAuthStore } from '@/pages/auth/store'
import TodoEvents from '@/pages/tasks/layouts/todo-events/index.vue'
import TodoTags from '@/pages/tasks/layouts/todo-tags/index.vue'
import TodoComments from '@/pages/tasks/layouts/todo-comments/index.vue'

defineOptions({ name: 'TodoDetails' })
defineProps<{
    customStyle?: string
}>()

const tasksViewStore = useTasksViewStore()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const todoStore = useTodoStore()

const { smartListData } = storeToRefs(projectStore)
const shadowTodo = ref<Todo>()
const statePickerOptions = ref([...TodoStateOptions])
const priorityPickerOptions = ref([...TodoPriorityOptions])
const projectPickerOptions = computed(() => {
    return [
        { label: '收集箱', value: authStore.user?.id || '' },
        ...smartListData.value.map((p: Project) => ({
            label: p.title,
            value: p.id
        }))
    ]
})

const { todoDetailsId, todoDetailsVisible } = storeToRefs(tasksViewStore)

const getTodoDetails = () => {
    console.log(todoDetailsId.value)
    if (!todoDetailsId.value) return
    shadowTodo.value = todoStore.getTodoByIdFromLocal(todoDetailsId.value)
    console.log(shadowTodo.value)
}

watch(
    () => todoDetailsVisible.value,
    (visible) => {
        if (!visible) return
        getTodoDetails()
    },
    { immediate: true }
)
</script>

<template>
    <wd-popup
        v-model="todoDetailsVisible"
        :custom-style="customStyle"
        position="right"
        safe-area-inset-bottom
    >
        <view class="todo-details">
            <view class="todo-details__header">
                <nuem-button icon="arrow-left" theme="ico" @click="todoDetailsVisible = false" />
                <text class="todo-details__header__title text--clamped">待办任务详情</text>
                <view class="todo-details__header__actions">
                    <nuem-button icon="heart" theme="ico" />
                    <!--                    <nuem-button icon="delete" theme="ico" />-->
                </view>
            </view>
            <view v-if="shadowTodo" class="todo-details__main">
                <view class="todo-details__main__actions">
                    <wd-picker
                        v-model="shadowTodo.state"
                        :columns="statePickerOptions"
                        label="状态"
                        use-default-slot
                    >
                        <todo-state-info :state="shadowTodo.state" />
                    </wd-picker>
                    <wd-picker
                        v-model="shadowTodo.priority"
                        :columns="priorityPickerOptions"
                        label="优先级"
                        use-default-slot
                    >
                        <todo-priority-info :priority="shadowTodo.priority" />
                    </wd-picker>
                    <view style="flex: auto"></view>
                    <wd-picker
                        v-model="shadowTodo.projectId"
                        :columns="projectPickerOptions"
                        label="清单"
                        use-default-slot
                    >
                        <todo-project-info :projectId="shadowTodo.projectId" />
                    </wd-picker>
                </view>
                <view class="todo-details__main__inputs">
                    <wd-textarea
                        v-model="shadowTodo.name"
                        auto-height
                        custom-textarea-class="todo-details__main__inputs--name"
                        no-border
                        placeholder="待办标题"
                    />
                    <wd-textarea
                        v-model="shadowTodo.description"
                        auto-height
                        custom-textarea-class="todo-details__main__inputs--description"
                        no-border
                        placeholder="输入您的任务描述..."
                    />
                </view>
                <todo-events />
                <todo-tags />
                <todo-comments />
            </view>
            <view class="todo-details__footer"></view>
        </view>
    </wd-popup>
</template>

<style scoped>
.todo-details {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    padding: calc(var(--menu-button-top) + 1rem) 1rem 1rem;
    box-sizing: border-box;
    flex: none;
    background-color: white;
}

.todo-details__header {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.5rem;
    margin-right: 6rem;
    height: 32px;
}

.todo-details__header__title {
    font-size: 1.14rem;
    flex: auto;
    display: block;
    max-height: calc(3 * var(--line-height));
    overflow: hidden;
    text-overflow: ellipsis;
}

.todo-details__header__actions {
    display: flex;
    align-items: center;
}

.todo-details__main {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    flex: auto;
    gap: 1rem;
}

.todo-details__main__actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    height: 36px;
}

.todo-details__main__inputs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
</style>
