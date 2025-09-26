<script setup lang="ts">
import TasksDetails from './details.vue'
import { ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import type { NueDrawer } from 'nue-ui'

const route = useRoute()

const visible = ref(false)
const drawerRef = ref<InstanceType<typeof NueDrawer>>()

const handleClose = () => {
    if (!drawerRef.value) {
        visible.value = false
        return
    }
    drawerRef.value.close()
}

watchEffect(
    () => {
        const todoId = route.params.todoId as string
        if (!todoId) {
            handleClose()
            return
        }
        visible.value = true
    },
    { flush: 'post' }
)
</script>

<template>
    <nue-drawer
        v-model="visible"
        theme="outline"
        allow-close-by-overlay
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
