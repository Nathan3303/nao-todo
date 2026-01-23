<script setup lang="ts">
import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ProjectPreference } from '@nao-todo/types'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import { computed } from 'vue'

defineOptions({ name: 'TasksDropdownColumnDisplayOperator' })
const props = defineProps<{
    columns: ProjectPreference['columns']
    labelGetter: (key: string) => string
}>()
const emit = defineEmits<{
    (e: 'update', key: keyof ProjectPreference['columns'], value: boolean): void
}>()

const count = computed<number>(() => {
    let count = 0
    Object.keys(props.columns).forEach((key) => {
        if (props.columns[key as keyof ProjectPreference['columns']]) count++
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
            checked: props.columns[key as keyof ProjectPreference['columns']]
        })
    })
    return options
})

const handleExecute = (id: string) => {
    const oldValue = props.columns[id as keyof ProjectPreference['columns']]
    const newValue = !oldValue
    emit('update', id as keyof ProjectPreference['columns'], newValue)
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
