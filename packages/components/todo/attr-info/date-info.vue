<script setup lang="ts">
import { computed } from 'vue'
import { useRelativeDate } from '@nao-todo/hooks'
import TodoBasicInfo from './basic-info.vue'
import moment from 'moment'

defineOptions({ name: 'TodoDateInfo' })
const props = defineProps<{
    date: string | Date
    formatter?: (date: string) => string
    colored?: boolean
}>()

const formattedDate = computed(() => {
    if (!props.date) {
        return ''
    }
    const date = useRelativeDate(props.date)
    return props.formatter ? props.formatter(date) : date
})

const isExpired = computed(() => {
    if (!props.date) return false
    return moment(props.date).isBefore(moment())
})
</script>

<template>
    <todo-basic-info
        icon="time"
        :text="formattedDate"
        :data-expired="colored ? isExpired : void 0"
    />
</template>

<style scoped>
.nue-div--basic-info[data-expired='true'] {
    color: rgb(255, 74, 74);
}
</style>

