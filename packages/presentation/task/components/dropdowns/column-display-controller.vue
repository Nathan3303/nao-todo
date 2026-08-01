<script setup lang="ts">
import type { TaskColumnOptions } from '@nao-todo/shared'
import { InnerDropdown, InnerDropdownOption, type InnerDropdownOptionVO } from '@nao-todo/shared'
import { computed } from 'vue'

defineOptions({ name: 'TaskColumnDisplayController' })
const props = defineProps<{
    columns: TaskColumnOptions
    labelGetter: (key: keyof TaskColumnOptions) => string
}>()
const emit = defineEmits<{
    (e: 'update', key: keyof TaskColumnOptions, value: boolean): void
}>()

const count = computed<number>(() => {
    let count = 0
    Object.keys(props.columns).forEach((key) => {
        if (props.columns[key as keyof TaskColumnOptions]) count++
    })
    return count
})

const columnOptions = computed<InnerDropdownOptionVO[]>(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(props.columns).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: props.labelGetter(key as keyof TaskColumnOptions),
            value: key,
            checked: props.columns[key as keyof TaskColumnOptions]
        })
    })
    return options
})

const handleExecute = (id: string) => {
    const oldValue = props.columns[id as keyof TaskColumnOptions]
    const newValue = !oldValue
    emit('update', id as keyof TaskColumnOptions, newValue)
}
</script>

<template>
    <inner-dropdown
        title="显示与隐藏列"
        @click.stop
        :suffix="count"
        :close-when-executed="false"
        @execute="handleExecute"
    >
        <inner-dropdown-option
            v-for="option in columnOptions"
            :key="option.label"
            :icon="option.icon"
            :title="option.label"
            :execute-id="option.value"
            :checked="option.checked"
        />
    </inner-dropdown>
</template>

<style scoped></style>