<template>
    <nue-dropdown theme="combo-box" v-bind="$attrs">
        <template #trigger="{ trigger }">
            <nue-button :icon="triggerIcon" size="small" @click="trigger">
                {{ triggerTitle }}
                <template v-if="!hideCounter && checkedOptionsCount" #append>
                    <nue-divider direction="vertical" />
                    <nue-text color="orange" size="12px"> + {{ checkedOptionsCount }}</nue-text>
                </template>
            </nue-button>
        </template>
        <template #default>
            <nue-container id="ComboBoxContainer">
                <nue-header @click.stop>
                    <nue-input
                        v-model="filterText"
                        :placeholder="`筛选${triggerTitle.toLowerCase()}`"
                        clearable
                        icon="search"
                        theme="small,pure"
                    />
                </nue-header>
                <nue-divider />
                <nue-main>
                    <nue-div align="stretch" gap="4px" vertical width="100%">
                        <template v-if="filteredOptions && filteredOptions.length">
                            <checkbox
                                v-for="option in filteredOptions"
                                :key="option.value + option.checked"
                                :checked="option.checked"
                                :count="option.suffix"
                                :icon="option.icon"
                                :label="option.label"
                                :value="option.value"
                                @check="handleCheck"
                            />
                        </template>
                        <nue-text v-else class="combo-box__empty-text"> 暂无数据 </nue-text>
                    </nue-div>
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { ComboBoxEmits, ComboBoxProps } from './types'
import { Checkbox } from '@nao-todo/components'

defineOptions({ name: 'ComboBox' })
const props = withDefaults(defineProps<ComboBoxProps>(), {
    triggerIcon: 'plus-circle',
    triggerTitle: 'Status',
    hideCounter: false
})
const emit = defineEmits<ComboBoxEmits>()

const filterText = ref('')

const filteredOptions = computed(() => {
    if (!filterText.value) return props.framework
    return props.framework.filter((option) => {
        return option.label.toLowerCase().includes(filterText.value.toLowerCase())
    })
})

const checkedOptionsCount = computed(() => {
    return filteredOptions.value.filter((option) => option.checked).length
})

const handleCheck = (checked: boolean, value: unknown) => {
    emit('change', value, { checked })
}
</script>

<style scoped>
.combo-box__empty-text {
    font-size: var(--nue-text-xs);
    padding: 8px;
    color: gray;
    text-align: center;
}

.nue-container#ComboBoxContainer {
    gap: 0.25rem;

    > .nue-header {
        height: auto;
        padding: 0 0.5rem;
        border: none;
    }
}
</style>
