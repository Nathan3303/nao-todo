<script setup lang="ts">
import TasksDetails from './details.vue'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const outlineDrawerVisible = ref(false)

watch(
    () => route.params.taskId,
    (newTasksId) => (outlineDrawerVisible.value = !!newTasksId),
    { immediate: true }
)
</script>

<template>
    <nue-drawer
        v-model:visible="outlineDrawerVisible"
        class="nue-drawer--no-header nue-drawer--tasks-outline"
        min-span="375px"
        span="480px"
        close-by-button-only
    >
        <tasks-details />
    </nue-drawer>
</template>
