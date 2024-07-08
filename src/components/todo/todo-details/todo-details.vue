<template>
    <empty
        :empty="!shadowTodo"
        message="Click on a task to see its details."
        text-size="12px"
        full-height
    >
        <nue-container class="details-wrapper" v-if="shadowTodo" :key="shadowTodo?.id">
            <nue-header align="center" justify="space-between" height="36px">
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-text size="16px">Task details</nue-text>
                    <nue-icon name="loading" v-if="loadingState" :spin="loadingState"></nue-icon>
                </nue-div>
                <nue-button theme="small" @click="emit('closeTodoDetails')" icon="clear">
                    Close
                </nue-button>
            </nue-header>
            <nue-main style="flex-direction: column; gap: 16px; padding: 16px 0">
                <template #content>
                    <Loading v-if="loading" placeholder="Loading task details..."></Loading>
                    <empty v-else :empty="!shadowTodo" message="Task not found.">
                        <nue-div vertical theme="card" align="stretch" gap="8px">
                            <details-row label="Id" :text="shadowTodo?.id"></details-row>
                            <details-row label="Name">
                                <nue-textarea
                                    v-model="shadowTodo.name"
                                    placeholder="Input task name here..."
                                    autosize
                                    theme="noshape"
                                    @blur="updateTodo"
                                ></nue-textarea>
                            </details-row>
                            <details-row label="Description">
                                <nue-textarea
                                    v-model="shadowTodo.description"
                                    placeholder="Input task description here..."
                                    :rows="0"
                                    autosize
                                    theme="noshape"
                                    @blur="updateTodo"
                                ></nue-textarea>
                            </details-row>
                        </nue-div>
                        <nue-div theme="card">
                            <details-row label="Start at" flex="1">
                                <nue-div gap="4px">
                                    <nue-button
                                        v-if="date.startAt === ''"
                                        theme="small"
                                        icon="plus"
                                        @click="handleSwitchStartDate(1)"
                                    >
                                        Add date
                                    </nue-button>
                                    <template v-else>
                                        <nue-input
                                            theme="small"
                                            type="datetime-local"
                                            v-model="date.startAt"
                                            @change="handleChangeDate"
                                        ></nue-input>
                                        <nue-button
                                            theme="small"
                                            icon="clear"
                                            @click="handleSwitchStartDate(0)"
                                        ></nue-button>
                                    </template>
                                </nue-div>
                            </details-row>
                            <details-row label="End at" flex="1">
                                <nue-div gap="4px">
                                    <nue-button
                                        v-if="date.endAt === ''"
                                        theme="small"
                                        icon="plus"
                                        @click="handleSwitchEndDate(1)"
                                    >
                                        Add date
                                    </nue-button>
                                    <template v-else>
                                        <nue-input
                                            theme="small"
                                            type="datetime-local"
                                            v-model="date.endAt"
                                            @change="handleChangeDate"
                                        ></nue-input>
                                        <nue-button
                                            theme="small"
                                            icon="clear"
                                            @click="handleSwitchEndDate(0)"
                                        ></nue-button>
                                    </template>
                                </nue-div>
                            </details-row>
                            <details-row
                                v-if="dueDateHint"
                                label="Hint"
                                :text="dueDateHint"
                            ></details-row>
                        </nue-div>
                        <nue-div theme="card">
                            <details-row label="Priority" flex="1">
                                <nue-select
                                    v-model="shadowTodo.priority"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option label="Low" value="low"></nue-select-option>
                                    <nue-select-option
                                        label="Medium"
                                        value="medium"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="High"
                                        value="high"
                                    ></nue-select-option>
                                </nue-select>
                            </details-row>
                            <details-row label="State" flex="1">
                                <nue-select
                                    v-model="shadowTodo.state"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option
                                        label="To Do"
                                        value="todo"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="In Progress"
                                        value="in-progress"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="Done"
                                        value="done"
                                    ></nue-select-option>
                                </nue-select>
                            </details-row>
                        </nue-div>
                        <nue-div theme="card">
                            <details-row
                                v-if="shadowTodo?.createdAt"
                                label="Created at"
                                :text="parseDate(shadowTodo?.createdAt)"
                                flex="1"
                            ></details-row>
                            <details-row
                                v-if="shadowTodo?.updatedAt"
                                label="Updated at"
                                :text="parseDate(shadowTodo?.updatedAt)"
                                flex="1"
                            ></details-row>
                        </nue-div>
                    </empty>
                </template>
            </nue-main>
            <!-- <nue-footer>
                <nue-button theme="small">Move to</nue-button>
            </nue-footer> -->
        </nue-container>
    </empty>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { Loading, Empty } from '@/components'
import { useTodoStore, type Todo } from '@/stores/use-todo-store'
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
    if (startAt === '' || endAt === '') return void 0
    const _startAt = moment(startAt)
    const _endAt = moment(endAt)
    const diff = _endAt.diff(_startAt, 'd')
    return `* According to the end date, This task will end in ${diff === 0 ? 'today' : `${diff} day(s)`}.`
})

function parseDate(datestring: string) {
    return moment(datestring).format('YYYY-MM-DD HH:mm')
}

function updateTodo() {
    loadingState.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
        const { todo } = props
        if (!shadowTodo.value && !todo) return
        const response = await todoStore.update(todo?.id!, shadowTodo.value!)
        if (response.code === '20000') {
            shadowTodo.value = response.data
        }
        loadingState.value = false
        timer = null
    }, 512)
}

function handleChangeDate() {
    const dueDate = dateInfo.reConvert(date)
    shadowTodo.value!.dueDate = dueDate
    updateTodo()
}

function handleSwitchStartDate(flag: 0 | 1) {
    if (flag) {
        date.startAt = dateInfo.parseDate(0)
    } else {
        date.startAt = ''
    }
    handleChangeDate()
}

function handleSwitchEndDate(flag: 0 | 1) {
    if (flag) {
        date.endAt = dateInfo.parseDate(0)
    } else {
        date.endAt = ''
    }
    handleChangeDate()
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
