<script setup lang="ts">
import { computed } from 'vue'
import relativeDateParser from '@nao-todo/infrastructure/utils/relative-date-parser'
import TodoBasicInfo from './basic-info.vue'
import moment from 'moment'

defineOptions({ name: 'TodoDateInfo' })
const props = defineProps<{
    date: string
    formatter?: (date: string) => string
    colored?: boolean
}>()

const formattedDate = computed(() => {
    if (!props.date) {
        return ''
    }
    const [relativeDate, err] = relativeDateParser(props.date)
    if (err !== null) {
        return ''
    }
    return props.formatter ? props.formatter(relativeDate) : relativeDate
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

