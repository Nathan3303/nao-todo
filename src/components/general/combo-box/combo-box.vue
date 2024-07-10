<template>
    <nue-dropdown class="combo-box-wrapper">
        <template #default="{ clickTrigger }">
            <nue-button size="small" :icon="triggerIcon" @click="clickTrigger">
                {{ triggerTitle }}
                <template v-if="checkedOptionsCount" #append>
                    <nue-divider direction="vertical" style="height: 12px"></nue-divider>
                    <nue-text size="12px" color="orange">+ {{ checkedOptionsCount }}</nue-text>
                </template>
            </nue-button>
        </template>
        <template #dropdown>
            <nue-container>
                <nue-header height="43px">
                    <nue-input
                        theme="noshape"
                        icon="search"
                        :placeholder="`筛选${triggerTitle.toLowerCase()}`"
                        v-model="filterText"
                    ></nue-input>
                </nue-header>
                <nue-main>
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
                    <nue-text v-else size="14px" color="gray" align="center">
                        No options found.
                    </nue-text>
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
    triggerTitle: 'Status'
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

<style scoped>
.combo-box-wrapper {
    &:deep(.nue-dropdown) {
        padding: 0;
    }

    .nue-button {
        border-style: dashed;
    }

    .nue-container {
        padding: 0;

        .nue-header {
            padding: 0px 12px;
        }

        .nue-main {
            flex-direction: column;
            padding: 4px;
        }
    }
}
</style>
