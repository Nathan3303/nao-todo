<template>
    <template v-if="simple">
        <nue-button
            v-if="simple"
            :theme="['small', isFiltering ? 'hl' : '']"
            icon="filter"
            @click="drawerData.visible = true"
        >
            筛选任务
            <template #append>
                <nue-text v-if="isFiltering" color="orange" size="var(--text-sm)">
                    +{{ isFiltering }}
                </nue-text>
            </template>
        </nue-button>
        <nue-drawer
            v-if="simple"
            v-model:visible="drawerData.visible"
            min-span="auto"
            open-from="bottom"
            span="auto"
            title="筛选任务"
        >
            <nue-div class="nue-drawer--filter-bar">
                <nue-input
                    v-model="filterText"
                    :debounce-time="360"
                    clearable
                    icon="filter"
                    placeholder="筛选任务"
                    theme="small"
                />
                <combo-box
                    :framework="stateComboBoxOptions"
                    trigger-title="状态"
                    @change="handleChangeStatusOption"
                />
                <combo-box
                    :framework="priorityComboBoxOptions"
                    trigger-title="优先级"
                    @change="handleChangePriorityOption"
                />
                <nue-button
                    v-if="isFiltering"
                    icon="clear"
                    style="margin-left: auto"
                    theme="small"
                    @click="handleResetFilter"
                >
                    重置
                </nue-button>
            </nue-div>
        </nue-drawer>
    </template>
    <template v-else>
        <nue-div align="center" gap="12px" width="fit-content">
            <nue-div gap="4px" vertical width="fit-content">
                <nue-input
                    v-model="filterText"
                    :debounce-time="360"
                    clearable
                    icon="filter"
                    placeholder="筛选任务"
                    theme="small"
                />
            </nue-div>
            <combo-box
                :framework="stateComboBoxOptions"
                trigger-title="状态"
                @change="handleChangeStatusOption"
            />
            <combo-box
                :framework="priorityComboBoxOptions"
                trigger-title="优先级"
                @change="handleChangePriorityOption"
            />
            <nue-button v-if="isFiltering" icon="clear" theme="small" @click="handleResetFilter">
                重置
            </nue-button>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ComboBox } from '@nao-todo/components/general'
import { useTodoFilterBar } from './use-filter-bar'
import type { TodoFilterBarProps, TodoFilterBarEmits } from './types'
import { reactive } from 'vue'

defineOptions({ name: 'TodoFilterBar' })
const props = defineProps<TodoFilterBarProps>()
const emit = defineEmits<TodoFilterBarEmits>()

const drawerData = reactive({
    visible: false
})

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
    flex: auto;
}

.nue-button--hl {
    border-color: orange;
}
</style>