<template>
    <nue-div class="calendar-aside">
        <nue-div class="calendar-aside__controller">
            <calendar-controller />
            <!-- <span>小日历</span> -->
            <!-- <span>用于控制 content 视图所显示的月份以及任务；包含短日期以及月份切换控件</span> -->
        </nue-div>
        <nue-divider />
        <nue-div class="calendar-aside__filters">
            <calendar-filters />
            <!-- <span>筛选器</span> -->
            <!-- <span>清单、标签等，以复选框形式出现</span> -->
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import CalendarController from './calendar-controller.vue'
import CalendarFilters from './calendar-filters.vue'

defineOptions({ name: 'CalendarAside' })
</script>

<style scoped>
.calendar-aside {
    flex-direction: column;
    height: 100%;

    .calendar-aside__controller {
        flex-direction: column;
        width: 100%;
        height: auto;
        border-radius: var(--primary-radius);
        overflow: hidden;
    }

    .calendar-aside__filters {
        flex-direction: column;
        width: 100%;
        flex: 1;
        border-radius: var(--primary-radius);
        overflow: hidden;
    }
}
</style>
