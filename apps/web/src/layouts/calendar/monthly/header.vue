<template>
    <nue-div class="calendar-content__header">
        <nue-button
            :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
            theme="icon,ghost"
            @click="switchDisplayAside"
        />
        <nue-text size="var(--text-xl)">{{ displayMonth }}</nue-text>
        <nue-div class="calendar-content__header__actions">
            <nue-button theme="small" @click="jumpToToday">跳转至今天</nue-button>
            <nue-button
                icon="plus"
                theme="primary,small"
                @click="dialogManager.open(TASK_CREATOR_DIALOG_KEY, {})"
            >
                新增待办事项
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { CalendarViewContext } from '@/views/index/calendar/calendar-view'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineProps<{ switchDisplayAside?: () => void; isDisplayAside?: boolean }>()

const { dialogManager } = inject<CalendarViewContext>(CALENDAR_VIEW_CONTEXT_KEY)!

const currentDate = ref(new Date())
const displayMonth = computed(
    () => `${currentDate.value.getFullYear()} 年 ${currentDate.value.getMonth() + 1} 月`
)

const jumpToToday = () => {
    currentDate.value = new Date()
}
</script>

<style scoped>
.calendar-content__header {
    width: 100%;
    height: 2.5rem;
    align-items: center;
    border-radius: var(--primary-radius);
    overflow: hidden;

    .calendar-content__header__actions {
        flex: 1;
        justify-content: end;
        align-items: center;
    }
}
</style>

