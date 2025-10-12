<script setup lang="ts">
import { IndexAside } from '@/layouts/index-aside'
import TasksAside from './aside.vue'

defineOptions({ name: 'TasksAsideDrawer' })
</script>

<template>
    <index-aside>
        <tasks-aside />
    </index-aside>
</template>
