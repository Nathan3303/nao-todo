<script setup lang="ts">
import { AppFloatAside } from '@/layouts/app'
import TasksAside from './aside.vue'

defineOptions({ name: 'TasksAsideDrawer' })
</script>

<template>
    <app-float-aside>
        <tasks-aside width="100%" />
    </app-float-aside>
</template>
