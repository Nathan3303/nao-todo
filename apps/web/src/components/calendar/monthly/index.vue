<script setup lang="ts">
import { inject } from 'vue'
import { CALENDAR_MONTHLY_CONTEXT_KEY } from '../monthly-context'
import CalendarMonthGrid from './month-grid.vue'
import CalendarStandalone from './standalone.vue'

defineOptions({ name: 'CalendarMonthly' })

// @context 应用内由宿主（`views/index/calendar/host.vue`）provide；无宿主（单测/独立挂载）走自足兜底
const host = inject(CALENDAR_MONTHLY_CONTEXT_KEY, null)
</script>

<template>
    <calendar-standalone v-if="!host" />
    <calendar-month-grid v-else />
</template>