<template>
    <nue-div align="center" width="fit-content" gap="12px">
        <nue-div vertical width="fit-content" gap="4px">
            <nue-input
                theme="small"
                v-model="filterText"
                placeholder="筛选任务"
                icon="filter"
                :debounce-time="360"
                clearable
            />
        </nue-div>
        <combo-box
            trigger-title="状态"
            :framework="stateComboBoxOptions"
            @change="handleChangeStatusOption"
        />
        <combo-box
            trigger-title="优先级"
            :framework="priorityComboBoxOptions"
            @change="handleChangePriorityOption"
        />
        <nue-text v-if="props.filterInfo.id" size="12px" color="gray">
            Id: {{ props.filterInfo.id }}
        </nue-text>
        <nue-button v-if="isFiltering" theme="small" icon="clear" @click="handleResetFilter">
            重置
        </nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import { ComboBox } from '@/components/general'
import { useTodoFilterBar } from './use-filter-bar'
import type { TodoFilterBarProps, TodoFilterBarEmits } from './types'

defineOptions({ name: 'ProjectFilterBar' })
const props = defineProps<TodoFilterBarProps>()
const emit = defineEmits<TodoFilterBarEmits>()

const {
    filterText,
    isFiltering,
    stateComboBoxOptions,
    priorityComboBoxOptions,
    handleChangeStatusOption,
    handleChangePriorityOption,
    handleResetFilter
} = useTodoFilterBar(props, emit)
</script>

<style scoped>
.nue-input--actived {
    border-color: orange;
    box-shadow: var(--secondary-shadow);
}

.nue-input--small {
    width: 200px;
    font-size: var(--text-xs);
}
</style>
