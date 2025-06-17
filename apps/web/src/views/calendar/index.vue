<template>
    <nue-container id="NaoTodoCalenderView" theme="vertical,inner">
        <nue-main
            aside-width="18rem"
            :allow-hide-aside="false"
            :allow-resize-aside="false"
            :allow-collapse-aside="false"
            style="border: none"
        >
            <template #aside>
                <calendar-aside />
            </template>
            <template #content>
                <calendar-content />
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { CalendarAside } from './aside'
import { CalendarContent } from './content'
</script>

<style scoped></style>
