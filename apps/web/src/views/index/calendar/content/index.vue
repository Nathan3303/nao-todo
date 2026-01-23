<template>
    <nue-div class="calendar-content">
        <content-header />
        <nue-div class="calendar-content__main">
            <content-main />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import ContentHeader from './content-header.vue';
import ContentMain from './content-main.vue';

defineOptions({ name: 'CalendarContent' })
</script>

<style scoped>
.calendar-content {
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
