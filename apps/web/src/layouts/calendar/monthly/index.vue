<template>
    <nue-container theme="calendar-monthly-view">
        <nue-header>
            <monthly-header
                :switch-display-aside="switchDisplayAside"
                :is-display-aside="isDisplayAside"
            />
        </nue-header>
        <nue-main>
            <nue-content fill>
                <monthly-main />
            </nue-content>
        </nue-main>
        <nue-footer></nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import MonthlyHeader from './header.vue'
import MonthlyMain from './main.vue'

defineOptions({ name: 'CalendarContent' })

defineProps<{ switchDisplayAside?: () => void; isDisplayAside?: boolean }>()
</script>

<style scoped>
.nue-container--calendar-monthly-view {
    flex-direction: column;
    height: 100%;

    .calendar-content__main {
        flex-direction: column;
        width: 100%;
        flex: 1;
        border-radius: var(--primary-radius);
        overflow: hidden;
    }
}
</style>

