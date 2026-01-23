<template>
    <nue-div class="calendar-todo">
        <div class="calendar-todo__priority-bar"></div>
        <nue-text class="calendar-todo__time">09:00am</nue-text>
        <nue-text class="calendar-todo__dot">·</nue-text>
        <nue-text class="calendar-todo__title" :clamped="1">实现日历板块大致布局</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
defineOptions({ name: 'CalendarTodo' })
</script>

<style scoped>
.calendar-todo {
    padding: 0.125rem 0.25rem;
    border: 1px solid transparent;
    border-radius: var(--primary-radius);
    box-shadow: 0px 3px 1px 0px rgba(200, 200, 200, 0.1);
    display: flex;
    overflow: hidden;
    flex-wrap: nowrap;
    align-items: center;
    background: white;
    transition: all 0.16s ease-in-out;
    gap: 0.25rem;
    margin: 0 0.25rem;
    flex: auto;

    &:hover {
        border-color: var(--primary-color-300);
    }

    .calendar-todo__priority-bar {
        width: 0.25rem;
        height: 0.875rem;
        background-color: var(--primary-color-600);
        margin: 0 0.25rem;
        border-radius: 0.25rem;
        flex: none;
    }

    .calendar-todo__time {
        flex: none;
        font-size: 0.75rem;
        color: var(--primary-color-500);
    }

    .calendar-todo__title {
        font-size: 0.75rem;
    }
}

@media screen and (max-width: 1024px) {
    .calendar-todo {
        gap: 0;

        .calendar-todo__time,
        .calendar-todo__dot {
            display: none;
        }
    }
}
</style>
