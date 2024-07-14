<template>
    <empty
        :empty="!shadowTodo"
        message="点击左侧列表中的任务名称查看详情。"
        text-size="12px"
        full-height
    >
        <nue-container class="details-wrapper" v-if="shadowTodo" :key="shadowTodo?.id">
            <nue-header align="center" justify="space-between" height="36px">
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-text size="16px">任务详情</nue-text>
                    <nue-icon name="loading" v-if="loadingState" :spin="loadingState"></nue-icon>
                </nue-div>
                <nue-div width="fit-content" gap="8px" align="center">
                    <!-- <nue-button theme="small">移动到</nue-button> -->
                    <switch-button
                        v-model="shadowTodo.isPinned"
                        size="small"
                        icon="heart"
                        active-icon="heart-fill"
                        text="收藏"
                        active-text="取消收藏"
                        @change="updateTodo"
                    ></switch-button>
                    <nue-divider direction="vertical"></nue-divider>
                    <nue-button theme="small" @click="emit('closeTodoDetails')" icon="clear">
                        关闭
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-main style="flex-direction: column; gap: 16px; padding: 16px 0">
                <template #content>
                    <Loading v-if="loading" placeholder="正在加载任务详情..."></Loading>
                    <empty v-else :empty="!shadowTodo" message="无法获取任务详情。">
                        <!-- 基本数据 -->
                        <nue-div vertical theme="card" align="stretch" gap="8px">
                            <details-row label="任务名称">
                                <nue-textarea
                                    v-model="shadowTodo.name"
                                    placeholder="输入您的任务名称..."
                                    autosize
                                    theme="noshape"
                                    @blur="updateTodo"
                                ></nue-textarea>
                            </details-row>
                            <details-row label="任务描述">
                                <nue-textarea
                                    v-model="shadowTodo.description"
                                    placeholder="输入您的任务描述..."
                                    :rows="0"
                                    autosize
                                    theme="noshape"
                                    @blur="updateTodo"
                                ></nue-textarea>
                            </details-row>
                        </nue-div>
                        <!-- 检查事项设置 -->
                        <nue-div vertical theme="card" align="stretch" gap="8px">
                            <details-row :label="`检查事项 ${eventsProgress}`">
                                <todo-event-row
                                    v-for="event in shadowTodo.events"
                                    :key="event.id"
                                    :event="event"
                                    @update="handleUpdateTodoEvent"
                                    @delete="handleDeleteTodoEvent"
                                ></todo-event-row>
                                <input-button
                                    icon="plus-circle"
                                    button-text="添加检查事项"
                                    theme="pure,noshape"
                                    :submit-on-blur="false"
                                    @submit="handleInputButtonSubmit"
                                ></input-button>
                            </details-row>
                        </nue-div>
                        <!-- 日期设置 -->
                        <nue-div theme="card">
                            <!-- <details-row label="开始于" width="fit-content">
                                <nue-div gap="4px" align="center">
                                    <nue-button
                                        v-if="date.startAt === ''"
                                        theme="small"
                                        icon="plus"
                                        @click="handleSwitchStartDate(1)"
                                    >
                                        添加日期
                                    </nue-button>
                                    <template v-else>
                                        <nue-input
                                            theme="small,noshape"
                                            type="datetime-local"
                                            v-model="date.startAt"
                                            @change="handleChangeDate"
                                            style="width: 170px"
                                        ></nue-input>
                                        <nue-button
                                            theme="small,pure"
                                            icon="clear"
                                            @click="handleSwitchStartDate(0)"
                                        ></nue-button>
                                    </template>
                                </nue-div>
                            </details-row> -->
                            <details-row :label="`任务结束时间 ${dueDateHint}`" width="fit-content">
                                <nue-div gap="4px" align="center">
                                    <nue-button
                                        v-if="date.endAt === ''"
                                        theme="small"
                                        icon="plus"
                                        @click="handleSwitchEndDate(1)"
                                    >
                                        添加结束时间
                                    </nue-button>
                                    <template v-else>
                                        <nue-input
                                            theme="small"
                                            type="datetime-local"
                                            v-model="date.endAt"
                                            @change="handleChangeDate"
                                            style="width: 180px"
                                        ></nue-input>
                                        <nue-button
                                            theme="small"
                                            icon="clear"
                                            @click="handleSwitchEndDate(0)"
                                        ></nue-button>
                                    </template>
                                </nue-div>
                            </details-row>
                        </nue-div>
                        <!-- 其他设置 -->
                        <nue-div theme="card" gap="24px">
                            <details-row label="任务优先级" width="fit-content">
                                <nue-select
                                    v-model="shadowTodo.priority"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option label="低" value="low"></nue-select-option>
                                    <nue-select-option
                                        label="中"
                                        value="medium"
                                    ></nue-select-option>
                                    <nue-select-option label="高" value="high"></nue-select-option>
                                </nue-select>
                            </details-row>
                            <details-row label="任务状态" width="fit-content">
                                <nue-select
                                    v-model="shadowTodo.state"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option
                                        label="待办"
                                        value="todo"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="正在进行"
                                        value="in-progress"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="已完成"
                                        value="done"
                                    ></nue-select-option>
                                </nue-select>
                            </details-row>
                        </nue-div>
                        <!-- 时间数据 -->
                        <nue-div theme="card">
                            <details-row
                                v-if="shadowTodo?.createdAt"
                                label="创建时间"
                                :text="parseDate(shadowTodo?.createdAt)"
                                flex="1"
                            ></details-row>
                            <details-row
                                v-if="shadowTodo?.updatedAt"
                                label="最后修改时间"
                                :text="parseDate(shadowTodo?.updatedAt)"
                                flex="1"
                            ></details-row>
                        </nue-div>
                    </empty>
                </template>
            </nue-main>
        </nue-container>
    </empty>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import {
    Loading,
    Empty,
    InputButton,
    TodoEventRow,
    SwitchButton,
    type InputButtonSubmitPayload,
    type TodoEventRowUpdatePayload
} from '@/components'
import { useTodoStore, type Todo, type TodoEvent } from '@/stores/use-todo-store'
import moment from 'moment'
import { useDateInfo } from '@/utils/todo/use-date-info'
import DetailsRow from './details-row.vue'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'

const props = defineProps<TodoDetailsProps>()
const emit = defineEmits<TodoDetailsEmits>()

const todoStore = useTodoStore()
const dateInfo = useDateInfo()

const shadowTodo = ref<Todo | undefined>()
const loadingState = ref(false)
let timer: number | null = null
const date = reactive({ startAt: '', endAt: '' })

const dueDateHint = computed(() => {
    const { startAt, endAt } = date
    let result = ''
    if (endAt !== '') {
        // const _startAt = moment(startAt)
        const _endAt = moment(endAt)
        const diff = _endAt.diff(moment(), 'days')
        // console.log(endAt, diff)
        if (diff === 0) {
            const minuteDiff = _endAt.diff(moment(), 'minutes')
            if (minuteDiff >= 0) {
                result = '任务即将结束，不到1天'
            } else if (minuteDiff < 0) {
                result = '任务已结束，不到1天'
            }
        } else if (diff < 0) {
            result = `任务已结束，${Math.abs(diff)} 天前`
        } else {
            result = `任务将在 ${diff} 天后结束`
        }
    }
    return result === '' ? '' : `(${result})`
})

const eventsProgress = computed(() => {
    if (!shadowTodo.value) return ''
    const events = shadowTodo.value.events
    const progress = events ? events.filter((event) => event.isDone).length : 0
    const total = events ? events.length : 0
    const percentage = total ? Math.floor((progress / total) * 100) : 0
    // console.log(events, progress, total, percentage)
    return `(${progress}/${total}, ${percentage}%)`
})

const parseDate = (datestring: string) => {
    return moment(datestring).format('YYYY-MM-DD HH:mm')
}

const updateCompare = (oldTodo: Todo, newTodo: Todo) => {
    const nameCompare = oldTodo.name === newTodo.name
    const descriptionCompare = oldTodo.description === newTodo.description
    const priorityCompare = oldTodo.priority === newTodo.priority
    const stateCompare = oldTodo.state === newTodo.state
    const dueDateCompare = oldTodo.dueDate === newTodo.dueDate
    const eventsCompare = oldTodo.events.length === newTodo.events.length
    const pinnedCompare = oldTodo.isPinned === newTodo.isPinned
    return (
        nameCompare &&
        descriptionCompare &&
        priorityCompare &&
        stateCompare &&
        dueDateCompare &&
        eventsCompare &&
        pinnedCompare
    )
}

const updateTodo = () => {
    loadingState.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
        const { todo } = props
        if (!shadowTodo.value && !todo) return
        const isSame = updateCompare(todo!, shadowTodo.value!)
        if (!isSame) {
            const response = await todoStore.update(todo?.id!, shadowTodo.value!)
            if (response.code === '20000') {
                shadowTodo.value = response.data
            }
        }
        loadingState.value = false
        timer = null
    }, 512)
}

const handleChangeDate = () => {
    // const isValid = dateInfo.checkDate(date);
    // console.log(isValid)
    const dueDate = dateInfo.reConvert(date)
    shadowTodo.value!.dueDate = dueDate
    updateTodo()
}

const handleSwitchStartDate = (flag: 0 | 1) => {
    if (flag) {
        date.startAt = dateInfo.parseDate(0)
    } else {
        date.startAt = ''
    }
    handleChangeDate()
}

const handleSwitchEndDate = (flag: 0 | 1) => {
    if (flag) {
        date.endAt = dateInfo.parseDate(0)
    } else {
        date.endAt = ''
    }
    handleChangeDate()
}

const handleInputButtonSubmit = (payload: InputButtonSubmitPayload) => {
    if (!props.todo) return
    const { id: todoId } = props.todo
    const { value } = payload
    loadingState.value = true
    emit('createTodoEvent', todoId, { title: value })
    setTimeout(() => (loadingState.value = false), 512)
}

const handleUpdateTodoEvent = (event: TodoEventRowUpdatePayload) => {
    const id = event.id
    const newTodoEvent = event
    loadingState.value = true
    emit('updateTodoEvent', id, newTodoEvent)
    setTimeout(() => (loadingState.value = false), 512)
}

const handleDeleteTodoEvent = async (id: TodoEvent['id']) => {
    loadingState.value = true
    // emit('updateTodoEvent', id, newTodoEvent)
    const res = await todoStore.deleteTodoEvent(id)
    setTimeout(() => (loadingState.value = false), 512)
}

watch(
    () => props.todo,
    (newValue) => {
        shadowTodo.value = newValue ? { ...newValue } : void 0
        const _date = dateInfo.convert(shadowTodo.value?.dueDate)
        date.startAt = _date.startAt
        date.endAt = _date.endAt
    },
    { immediate: true }
)
</script>

<style scoped>
@import url('./todo-details.css');
</style>
