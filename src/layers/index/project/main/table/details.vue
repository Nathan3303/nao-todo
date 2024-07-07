<template>
    <nue-div class="details-wrapper" v-if="shadowTodo" :key="shadowTodo.id">
        <nue-div align="center" justify="space-between">
            <nue-div align="center" width="fit-content" gap="8px">
                <nue-text size="16px">Task details</nue-text>
                <nue-icon name="loading" v-if="loadingState" :spin="loadingState"></nue-icon>
            </nue-div>
            <nue-button theme="pure" @click="emit('closeTodoDetails')" icon="clear"></nue-button>
        </nue-div>
        <nue-divider></nue-divider>
        <Loading v-if="loading" placeholder="Loading task details..."></Loading>
        <template v-else>
            <nue-div vertical theme="card" align="stretch" gap="8px">
                <nue-div vertical align="stretch" gap="4px">
                    <nue-text size="12px" color="gray">Id</nue-text>
                    <nue-text size="12px">{{ shadowTodo?.id }}</nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px">
                    <nue-text size="12px" color="gray">Name</nue-text>
                    <nue-textarea
                        v-model="shadowTodo.name"
                        placeholder="Input task name here..."
                        autosize
                        theme="noshape"
                        @blur="updateTodo"
                    ></nue-textarea>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px">
                    <nue-text size="12px" color="gray"> Description </nue-text>
                    <nue-textarea
                        v-model="shadowTodo.description"
                        placeholder="Input task description here..."
                        :rows="0"
                        autosize
                        theme="noshape"
                        @blur="updateTodo"
                    ></nue-textarea>
                </nue-div>
            </nue-div>
            <!-- <nue-div vartical theme="card">
                <nue-text>Step</nue-text>
            </nue-div> -->
            <nue-div theme="card">
                <nue-div vertical gap="4px" width="fit-content">
                    <nue-text size="12px" color="gray">Start at</nue-text>
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
                                style="width: 170px"
                            ></nue-input>
                            <nue-button
                                theme="small"
                                icon="clear"
                                @click="handleSwitchStartDate(0)"
                            ></nue-button>
                        </template>
                    </nue-div>
                </nue-div>
                <nue-div vertical gap="4px" width="fit-content">
                    <nue-text size="12px" color="gray">End at</nue-text>
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
                                style="width: 170px"
                            ></nue-input>
                            <nue-button
                                theme="small"
                                icon="clear"
                                @click="handleSwitchEndDate(0)"
                            ></nue-button>
                        </template>
                    </nue-div>
                </nue-div>
                <nue-div v-if="dueDateHint">
                    <nue-text size="13px" color="gray"> {{ dueDateHint }} </nue-text>
                </nue-div>
            </nue-div>
            <nue-div theme="card">
                <nue-div vertical gap="4px" width="fit-content">
                    <nue-text size="12px" color="gray">Priority</nue-text>
                    <nue-select v-model="shadowTodo.priority" size="small" @change="updateTodo">
                        <nue-select-option label="Low" value="low"></nue-select-option>
                        <nue-select-option label="Medium" value="medium"></nue-select-option>
                        <nue-select-option label="High" value="high"></nue-select-option>
                    </nue-select>
                </nue-div>
                <nue-div vertical gap="4px" width="fit-content">
                    <nue-text size="12px" color="gray">State</nue-text>
                    <nue-select v-model="shadowTodo.state" size="small" @change="updateTodo">
                        <nue-select-option label="To Do" value="todo"></nue-select-option>
                        <nue-select-option
                            label="In Progress"
                            value="in-progress"
                        ></nue-select-option>
                        <nue-select-option label="Done" value="done"></nue-select-option>
                    </nue-select>
                </nue-div>
            </nue-div>
            <nue-div theme="card">
                <nue-div v-if="shadowTodo?.createdAt" vertical width="fit-content" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Created at </nue-text>
                    <nue-text size="12px">{{ parseDate(shadowTodo?.createdAt) }}</nue-text>
                </nue-div>
                <nue-div v-if="shadowTodo?.updatedAt" vertical width="fit-content" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Updated at </nue-text>
                    <nue-text size="12px">{{ parseDate(shadowTodo?.updatedAt) }}</nue-text>
                </nue-div>
            </nue-div>
        </template>
    </nue-div>
    <template v-else>
        <nue-div
            align="center"
            justify="center"
            height="100%"
            vertical
            flex
            width="64%"
            gap="12px"
            style="overflow: auto; min-width: 256px"
            wrap="nowrap"
        >
            <nue-text size="12px" color="gray"> Click on a task to see its details. </nue-text>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { Loading } from '@/components/general'
import { useTodoStore, type Todo } from '@/stores/use-todo-store'
import moment from 'moment'
import { useDateInfo } from '@/utils/todo/use-date-info'

const props = defineProps<{
    todo?: Todo
    loading?: boolean
}>()
const emit = defineEmits<{
    (event: 'closeTodoDetails'): void
    (event: 'updateTodoName', name: Todo['name']): void
}>()

const todoStore = useTodoStore()
const dateInfo = useDateInfo()

const shadowTodo = ref<Todo | undefined>()
const loadingState = ref(false)
let timer: number | null = null
const date = reactive({ startAt: '', endAt: '' })

const dueDateHint = computed(() => {
    const { startAt, endAt } = date
    if (startAt === '' || endAt === '') return false
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
    // console.log(shadowTodo.value!.dueDate)
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
.details-wrapper {
    flex-direction: column;
    height: 100%;
    overflow: auto;
    flex-wrap: nowrap;
    flex: auto;
}
</style>
