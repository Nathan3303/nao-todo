<template>
    <nue-div class="calendar-content__header">
        <nue-button icon="menu-close" theme="icon-only" />
        <nue-text size="var(--text-xl)" weight="500">2025 年 5 月</nue-text>
        <nue-div class="calendar-content__header__actions">
            <nue-button theme="small">跳转至今天</nue-button>
            <nue-divider direction="vertical" />
            <nue-button icon="plus" theme="primary,small">新增待办事项</nue-button>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts"></script>

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
