<script setup lang="ts">
import TasksDetails from './details.vue'
import { ref, watchEffect, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { NueDrawer } from 'nue-ui'

const route = useRoute()
const router = useRouter()

const visible = ref(false)
const drawerRef = ref<InstanceType<typeof NueDrawer>>()

const handleClose = async () => {
    if (!drawerRef.value) {
        visible.value = false
        return
    }
    drawerRef.value.close()
}

watchEffect(
    () => {
        if (!(route.params.todoId as string)) return handleClose()
        visible.value = true
    },
    { flush: 'post' }
)

watch(
    () => visible.value,
    async (newValue) => {
        if (newValue) return
        await router.replace({ name: route.name, params: { todoId: void 0 } })
    }
)
</script>

<template>
    <nue-drawer
        allow-close-by-overlay
        v-model="visible"
        theme="outline"
        span="420px"
        min-span="360px"
        ref="drawerRef"
    >
        <tasks-details @close="handleClose" />
    </nue-drawer>
</template>

<style>
.nue-drawer--outline {
    .nue-drawer__header {
        display: none;
    }
}
</style>
