<script setup lang="ts">
import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ProjectPreferenceVO } from '@nao-todo/types'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import { computed } from 'vue'

defineOptions({ name: 'TasksDropdownColumnDisplayOperator' })
const props = defineProps<{
    modelValue: ProjectPreferenceVO['columns']
    labelGetter: (key: string) => string
}>()

const count = computed<number>(() => {
    let count = 0
    Object.keys(props.modelValue).forEach((key) => {
        if (props.modelValue[key as keyof ProjectPreferenceVO['columns']]) count++
    })
    return count
})

const columnOptions = computed<InnerDropdownOptionVO[]>(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(props.modelValue).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: props.labelGetter(key),
            value: key,
            checked: props.modelValue[key as keyof ProjectPreferenceVO['columns']]
        })
    })
    return options
})
</script>

<template>
    <inner-dropdown title="显示与隐藏列" @click.stop :suffix="count" :close-when-executed="false">
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
