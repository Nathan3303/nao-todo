<script setup lang="ts">
import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ProjectPreferenceVO } from '@nao-todo/types'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import { computed } from 'vue'

defineOptions({ name: 'TasksDropdownColumnDisplayOperator' })
const props = defineProps<{
    columns: ProjectPreferenceVO['columns']
    labelGetter: (key: string) => string
}>()
const emit = defineEmits<{
    (e: 'update', key: string, value: boolean): void
}>()

const count = computed<number>(() => {
    let count = 0
    Object.keys(props.columns).forEach((key) => {
        if (props.columns[key as keyof ProjectPreferenceVO['columns']]) count++
    })
    return count
})

const columnOptions = computed<InnerDropdownOptionVO[]>(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(props.columns).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: props.labelGetter(key),
            value: key,
            checked: props.columns[key as keyof ProjectPreferenceVO['columns']]
        })
    })
    return options
})

const handleExecute = (id: string) => {
    const oldValue = props.columns[id as keyof ProjectPreferenceVO['columns']]
    const newValue = !oldValue
    emit('update', id, newValue)
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
