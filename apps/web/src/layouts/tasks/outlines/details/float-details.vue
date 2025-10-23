<script setup lang="ts">
import TasksDetails from './details.vue'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { NueDrawer } from 'nue-ui'

const route = useRoute()

const visible = ref(false)
const drawerRef = ref<InstanceType<typeof NueDrawer>>()

watch(
    () => route.params.todoId,
    (newId) => {
        if (newId) {
            drawerRef.value?.open()
            return
        }
        drawerRef.value?.close()
    },
    { immediate: true }
)
</script>

<template>
    <nue-drawer
        allow-close-by-overlay
        v-model="visible"
        theme="outline"
        span="min(100%, 430px)"
        min-span="360px"
        ref="drawerRef"
    >
        <tasks-details @close="$router.push({ params: { todoId: void 0 } })" />
    </nue-drawer>
</template>

<style>
.nue-drawer--outline {
    .nue-drawer__header {
        display: none;
    }
}
</style>

