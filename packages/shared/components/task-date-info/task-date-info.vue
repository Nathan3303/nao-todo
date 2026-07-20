<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { TaskBasicInfo } from '../task-basic-info'
import relativeDateParser from '../../utils/relative-date-parser'
import type { TaskDateInfoProps } from './types'

defineOptions({ name: 'TaskDateInfo' })
const props = defineProps<TaskDateInfoProps>()

const formattedDate = computed(() => {
    if (!props.date) return ''
    const [relativeDate, err] = relativeDateParser(props.date)
    if (err !== null) return ''
    return props.formatter ? props.formatter(relativeDate) : relativeDate
})

const isExpired = computed(() => {
    if (!props.date) return false
    return dayjs(props.date).isBefore(dayjs())
})
</script>

<template>
    <task-basic-info no-icon :text="formattedDate" :data-expired="colored ? isExpired : void 0" />
</template>

<style scoped>
.nue-div--basic-info[data-expired='true'] {
    color: var(--nue-error-color-60) !important;
}
</style>

