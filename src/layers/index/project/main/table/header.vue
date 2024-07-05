<template>
    <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
        <nue-div align="center" justify="space-between" wrap="nowrap" gap="16px">
            <nue-div align="center" wrap="nowrap" flex="none" width="fit-content" gap="12px">
                <nue-input
                    theme="small"
                    v-model="filterText"
                    placeholder="Filter tasks"
                    icon="filter"
                    :debounce-time="300"
                ></nue-input>
                <combo-box
                    :framework="statusComboBoxOptions"
                    @change="handleChangeStatusOption"
                ></combo-box>
                <combo-box
                    trigger-title="Priority"
                    :framework="priorityComboBoxOptions"
                    @change="handleChangePriorityOption"
                ></combo-box>
                <nue-button
                    v-if="hasFilter"
                    theme="small,pure"
                    icon="clear"
                    @click="handleResetFilter"
                >
                    Reset
                </nue-button>
            </nue-div>
            <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                <nue-button theme="small,primary" icon="plus-circle" @click="handleAddTodo">
                    Add
                </nue-button>
                <nue-dropdown
                    class="toggle-collumns-dropdown"
                    align="right"
                    @execute="handleToggleCollumns"
                >
                    <template #default="{ clickTrigger }">
                        <nue-button theme="small" icon="menu" @click.stop="clickTrigger">
                            View
                        </nue-button>
                    </template>
                    <template #dropdown>
                        <nue-container>
                            <nue-header>
                                <nue-text size="14px">Toggle collumns</nue-text>
                            </nue-header>
                            <nue-main>
                                <checkbox
                                    v-for="(value, key) in collumns"
                                    :label="key"
                                    :value="key"
                                    :checked="value"
                                    @check="handleToggleCollumns"
                                ></checkbox>
                            </nue-main>
                        </nue-container>
                    </template>
                </nue-dropdown>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type {
    Todo,
    TodoCountInfo,
    TodoFilter,
    TodoPriority,
    TodoState
} from '@/stores/use-todo-store'
import { NuePrompt, NueMessage } from 'nue-ui'
import { ComboBox, Checkbox } from '@/components'

type ToggleCollumnsPayload = {
    createdAt: boolean
    priority: boolean
    state: boolean
    description: boolean
}
type ToggleCollumnKeys = keyof ToggleCollumnsPayload

const props = defineProps<{
    countInfo: TodoCountInfo
    filterInfo: TodoFilter
    collumns: ToggleCollumnsPayload
}>()
const emit = defineEmits<{
    (event: 'addTodo', todoName: Todo['name']): void
    (event: 'filterTodos', payload: TodoFilter): void
    (event: 'toggleCollumns', payload: ToggleCollumnsPayload): void
}>()

const filterText = ref('')

const statusComboBoxOptions = computed({
    get() {
        type Option<T> = { label: string; value: T; icon: string; suffix: number; checked: boolean }
        const options: Option<TodoState>[] = [
            {
                label: 'Todo',
                value: 'todo',
                icon: 'circle',
                suffix: 0,
                checked: false
            },
            {
                label: 'In Progress',
                value: 'in-progress',
                icon: 'in-progress',
                suffix: 0,
                checked: false
            },
            {
                label: 'Done',
                value: 'done',
                icon: 'success',
                suffix: 0,
                checked: false
            }
        ]
        const { state } = props.filterInfo
        const splitedState = state?.split(',')
        options.forEach((option) => {
            if (splitedState?.includes(option.value)) {
                option.checked = true
            }
            if (props.countInfo.byState) {
                option.suffix = props.countInfo.byState[option.value] || 0
            }
        })
        return options
    },
    set(newValue: any) {
        let filterState = ''
        newValue.forEach((option: any) => {
            if (option.checked) {
                filterState += (filterState === '' ? '' : ',') + option.value
            }
        })
        emit('filterTodos', { state: filterState } as TodoFilter)
    }
})

const priorityComboBoxOptions = computed({
    get() {
        type Option<T> = { label: string; value: T; icon: string; suffix: number; checked: boolean }
        const options: Option<TodoPriority>[] = [
            {
                label: 'Low',
                value: 'low',
                icon: 'priority-1',
                suffix: 0,
                checked: false
            },
            {
                label: 'Medium',
                value: 'medium',
                icon: 'priority-2',
                suffix: 0,
                checked: false
            },
            {
                label: 'High',
                value: 'high',
                icon: 'priority-3',
                suffix: 0,
                checked: false
            }
        ]
        const { priority } = props.filterInfo
        const splitedPriority = priority?.split(',')
        options.forEach((option) => {
            if (splitedPriority?.includes(option.value as string)) {
                option.checked = true
            }
            if (props.countInfo.byPriority) {
                option.suffix = props.countInfo.byPriority[option.value] || 0
            }
        })
        return options
    },
    set(newValue: any) {
        let filterPriority = ''
        newValue.forEach((option: any) => {
            if (option.checked) {
                filterPriority += (filterPriority === '' ? '' : ',') + option.value
            }
        })
        emit('filterTodos', { priority: filterPriority } as TodoFilter)
    }
})

const hasFilter = computed(() => {
    const { name, state, priority } = props.filterInfo
    return name || state || priority
})

function handleAddTodo() {
    NuePrompt({
        title: 'Create new todo',
        placeholder: 'Please input todo name here...',
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then(
        (value) => {
            NueMessage.info('Creating todo "' + value + '" ...')
            emit('addTodo', value as Todo['name'])
        },
        () => NueMessage.info('Operation cancelled.')
    )
}

function handleChangeStatusOption(value: unknown, payload: any) {
    const _options = [...statusComboBoxOptions.value]
    _options.forEach((option, index) => {
        if (option.value === value) {
            _options[index] = { ...option, ...payload }
        }
    })
    statusComboBoxOptions.value = _options
}

function handleChangePriorityOption(value: unknown, payload: any) {
    const _options = [...priorityComboBoxOptions.value]
    _options.forEach((option, index) => {
        if (option.value === value) {
            _options[index] = { ...option, ...payload }
        }
    })
    priorityComboBoxOptions.value = _options
}

function handleResetFilter() {
    filterText.value = ''
    emit('filterTodos', { name: '', state: '', priority: '' } as TodoFilter)
}

function handleToggleCollumns(checked: boolean, value: unknown) {
    // console.log('handleToggleCollumns', checked, value)
    const newCollumns = { ...props.collumns }
    newCollumns[value as ToggleCollumnKeys] = checked
    emit('toggleCollumns', newCollumns)
}

watch(
    () => filterText.value,
    (newValue) => {
        emit('filterTodos', { name: newValue } as TodoFilter)
    }
)
</script>

<style scoped>
.nue-input--actived {
    border-color: orange;
    box-shadow: var(--secondary-shadow);
}

.toggle-collumns-dropdown {
    &:deep().nue-dropdown {
        padding: 0px;
    }
    .nue-container {
        width: 192px;
        padding: 0px;

        .nue-header {
            height: 43px;
            padding: 12px;
        }

        .nue-main {
            flex-direction: column;
            padding: 4px;
        }
    }
}
</style>
