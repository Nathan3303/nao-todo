<template>
    <nue-dropdown class="combo-box-wrapper">
        <template #default="{ clickTrigger }">
            <nue-button size="small" icon="plus-circle" @click="clickTrigger">Status</nue-button>
        </template>
        <template #dropdown>
            <nue-container>
                <nue-header height="43px">
                    <nue-input
                        theme="noshape"
                        icon="search"
                        placeholder="Filter status"
                        v-model="filterText"
                    ></nue-input>
                </nue-header>
                <nue-main>
                    <checkbox
                        v-for="option in filteredOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                        :icon="option.icon"
                        :count="option.suffix"
                        :checked="option.checked"
                        @check="handleCheck"
                    ></checkbox>
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
const props = defineProps<ComboBoxProps>()
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

function handleCheck(checked: boolean, value: unknown) {
    emit('change', value, { checked })
}
</script>

<style scoped>
.combo-box-wrapper {
    &:deep(.nue-dropdown) {
        padding: 0;
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
