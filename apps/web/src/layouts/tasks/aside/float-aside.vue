<script setup lang="ts">
import { GlobalFloatAside } from '@/layouts/global'
import TasksAside from './aside.vue'

defineOptions({ name: 'TasksAsideDrawer' })
</script>

<template>
    <global-float-aside>
        <tasks-aside width="100%" />
    </global-float-aside>
</template>
