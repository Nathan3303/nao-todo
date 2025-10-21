<script setup lang="ts">
import { computed } from 'vue'
import { useRelativeDate } from '@nao-todo/hooks'
import TodoBasicInfo from './basic-info.vue'

defineOptions({ name: 'TodoDateInfo' })
const props = defineProps<{
    date: string | Date
    formatter?: (date: string) => string
}>()

const formattedDate = computed(() => {
    if (!props.date) {
        return ''
    }
    const date = useRelativeDate(props.date)
    return props.formatter ? props.formatter(date) : date
})
</script>

<template>
    <todo-basic-info icon="time" :text="formattedDate" />
</template>

<style scoped></style>
