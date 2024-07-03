<template>
    <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
        <nue-div align="center" justify="space-between" wrap="nowrap" gap="16px">
            <nue-div align="center" wrap="nowrap" flex="none" width="fit-content" gap="12px">
                <nue-input
                    :theme="filterText ? 'small,actived' : 'small'"
                    v-model="filterText"
                    placeholder="Filter tasks"
                    icon="filter"
                    clearable
                    :debounce-time="300"
                ></nue-input>
                <!-- <nue-button theme="small" icon="plus-circle" disabled>Status</nue-button> -->
                <combo-box
                    :framework="statusComboBoxOptions"
                    @change="handleChangeOption"
                ></combo-box>
                <nue-button theme="small" icon="plus-circle" disabled>Priority</nue-button>
                <!-- <nue-text v-if="filterValue" size="12px" color="orange" decoration="underline">
                    Your are in the filtering mode!
                </nue-text> -->
            </nue-div>
            <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                <nue-button theme="small,primary" icon="plus-circle" @click="handleAddTodo">
                    Add
                </nue-button>
                <nue-button theme="small" icon="menu" disabled>View</nue-button>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Todo, TodoFilter } from '@/stores/use-todo-store'
import { NuePrompt, NueMessage } from 'nue-ui'
import { ComboBox } from '@/components'

const props = defineProps<{
    filterInfo: TodoFilter
}>()
const emit = defineEmits<{
    (event: 'addTodo', todoName: Todo['name']): void
    (event: 'filterTodos', payload: TodoFilter): void
}>()

const filterText = ref('')
const statusComboBoxOptions = computed({
    get() {
        const options = [
            {
                label: 'Todo',
                value: 'todo',
                icon: 'circle',
                suffix: 21,
                checked: false
            },
            {
                label: 'In Progress',
                value: 'in-progress',
                icon: 'in-progress',
                suffix: 20,
                checked: false
            },
            {
                label: 'Done',
                value: 'done',
                icon: 'success',
                suffix: 19,
                checked: false
            }
        ]
        const { state } = props.filterInfo
        if (!state) {
            return options
        }
        const splitedState = state.split(',')
        options.forEach((option) => {
            if (splitedState.includes(option.value)) {
                option.checked = true
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
        // console.log(filterState)
        emit('filterTodos', { state: filterState } as TodoFilter)
    }
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

function handleChangeOption(value: unknown, payload: any) {
    const _options = [...statusComboBoxOptions.value]
    _options.forEach((option, index) => {
        if (option.value === value) {
            _options[index] = { ...option, ...payload }
        }
    })
    // console.log(_options)
    statusComboBoxOptions.value = _options
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
</style>
