<template>
    <wd-overlay :show="visible" @click="hide">
        <wd-floating-panel v-if="visible" :anchors="[280]" :contentDraggable="false">
            <view class="add-todo-panel" @click.stop>
                <view class="add-todo-panel__header">
                    <text>新增待办任务</text>
                </view>
                <view class="add-todo-panel__main">
                    <wd-input
                        ref="inputRef"
                        v-model="newTodo.name"
                        clearable
                        placeholder="请输入待办事项（例如：今晚要看什么书）"
                    />
                    <wd-textarea
                        v-model="newTodo.description"
                        auto-height
                        placeholder="描述"
                        size="var(--text-sm)"
                    />
                    <view class="add-todo-panel__main__actions">
                        <wd-picker
                            v-model="newTodo.state"
                            :columns="statePickerOptions"
                            label="状态"
                            use-default-slot
                        >
                            <todo-state-info :state="newTodo.state" />
                        </wd-picker>
                        <wd-picker
                            v-model="newTodo.priority"
                            :columns="priorityPickerOptions"
                            label="优先级"
                            use-default-slot
                        >
                            <todo-priority-info :priority="newTodo.priority" />
                        </wd-picker>
                        <wd-datetime-picker
                            v-model="newTodo.dueDate!.endAt"
                            label="结束日期"
                            use-default-slot
                        >
                            <todo-date-info :date="newTodo.dueDate!.endAt" />
                        </wd-datetime-picker>
                        <wd-picker
                            v-model="newTodo.projectId"
                            :columns="projectPickerOptions"
                            label="清单"
                            use-default-slot
                        >
                            <todo-project-info :projectId="newTodo.projectId" />
                        </wd-picker>
                    </view>
                </view>
                <view class="add-todo-panel__footer">
                    <nuem-button theme="pri" @click="hide">提交</nuem-button>
                </view>
            </view>
        </wd-floating-panel>
    </wd-overlay>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue'
import { TodoStateOptions, TodoPriorityOptions } from '@/pages/tasks/constants'
import { useProjectStore } from '@/pages/tasks/stores/project'
import { useAuthStore } from '@/pages/auth/store'
import type { CreateTodoOptions, Project } from '@nao-todo/types'
import { storeToRefs } from 'pinia'
import TodoStateInfo from './state-info.vue'
import TodoPriorityInfo from './priority-info.vue'
import TodoDateInfo from './date-info.vue'
import TodoProjectInfo from './project-info.vue'
import NuemButton from '@/ui/button.vue'

defineOptions({ name: 'AddTodoPanel' })

const projectStore = useProjectStore()
const authStore = useAuthStore()

const defaultNewTodo: CreateTodoOptions = {
    name: '',
    description: '',
    state: 'todo',
    priority: 'low',
    projectId: authStore.user?.id || '',
    dueDate: { startAt: '', endAt: '' }
}

const { smartListData } = storeToRefs(projectStore)
const visible = ref(false)
const newTodo = ref<CreateTodoOptions>({ ...defaultNewTodo })
const inputRef = ref()
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

const show = () => {
    visible.value = true
}
const clear = () => (newTodo.value = { ...defaultNewTodo })
const hide = () => {
    clear()
    visible.value = false
}

onMounted(() => {})

watch(
    () => newTodo.value,
    (nv) => console.log(nv),
    { deep: true }
)

defineExpose({
    show,
    hide
})
</script>

<style scoped>
.add-todo-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
}

.add-todo-panel__header {
    background-color: #fff;
    padding: 1rem;
}

.add-todo-panel__header text {
    font-size: 32rpx;
    color: #333;
}

.add-todo-panel__main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0 1rem;
    gap: 0.5rem;
}

.add-todo-panel__main__drop-menu {
    position: relative;
}

.add-todo-panel__main__actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    height: 34px;
}

.add-todo-panel__footer {
    padding: 1rem;
}
</style>
