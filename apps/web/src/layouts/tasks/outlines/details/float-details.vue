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
    }
)
</script>

<template>
    <nue-drawer
        ref="drawerRef"
        allow-close-by-overlay
        v-model="visible"
        theme="outline"
        span="min(100%, 430px)"
        min-span="360px"
        @after-close="() => $router.push({ name: $route.name, params: { todoId: void 0 } })"
    >
        <tasks-details />
    </nue-drawer>
</template>

<style>
.nue-drawer.nue-drawer--outline {
    --nue-drawer-span: min(100%, 430px);
    --nue-drawer-min-span: 360px;

    .nue-drawer__header {
        display: none;
    }
}
</style>

