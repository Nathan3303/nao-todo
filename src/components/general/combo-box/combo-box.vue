<template>
    <nue-dropdown theme="combo-box" v-bind="$attrs">
        <template #default="{ clickTrigger }">
            <nue-button size="small" :icon="triggerIcon" @click="clickTrigger">
                {{ triggerTitle }}
                <template v-if="!hideCounter && checkedOptionsCount" #append>
                    <nue-divider direction="vertical" style="height: 12px"></nue-divider>
                    <nue-text size="12px" color="orange">
                        + {{ checkedOptionsCount }}
                    </nue-text>
                </template>
            </nue-button>
        </template>
        <template #dropdown>
            <nue-container class="combo-box-container">
                <nue-header>
                    <nue-input
                        theme="noshape,small"
                        icon="search"
                        :placeholder="`筛选${triggerTitle.toLowerCase()}`"
                        v-model="filterText"
                        clearable
                    ></nue-input>
                </nue-header>
                <nue-main>
                    <nue-div vertical align="stretch" gap="4px">
                        <template v-if="filteredOptions && filteredOptions.length">
                            <checkbox
                                v-for="option in filteredOptions"
                                :key="option.value + option.checked"
                                :label="option.label"
                                :value="option.value"
                                :icon="option.icon"
                                :count="option.suffix"
                                :checked="option.checked"
                                @check="handleCheck"
                            ></checkbox>
                        </template>
                        <nue-text v-else size="12px" color="gray" align="center">
                            暂无数据
                        </nue-text>
                    </nue-div>
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ComboBoxProps, FrameworkOption } from './types'
import { Checkbox } from '@/components'

defineOptions({ name: 'ComboBox' })
const props = withDefaults(defineProps<ComboBoxProps>(), {
    triggerIcon: 'plus-circle',
    triggerTitle: 'Status',
    hideCounter: false
})
const emit = defineEmits<{
    (event: 'change', value: unknown, payload: Partial<FrameworkOption>): void
}>()

const filterText = ref('')

const filteredOptions = computed(() => {
    const { framework } = props
    if (!filterText.value) {
        return framework
    }
    return framework.filter((option) =>
        option.label.toLowerCase().includes(filterText.value.toLowerCase())
    )
})

const checkedOptionsCount = computed(() => {
    return filteredOptions.value.filter((option) => option.checked).length
})

function handleCheck(checked: boolean, value: unknown) {
    emit('change', value, { checked })
}
</script>
