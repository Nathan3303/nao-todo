<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import useDropdownExecutor from './use-dropdown-executor'

const { register, unregisterAll, execute } = useDropdownExecutor()

onBeforeUnmount(() => unregisterAll())

defineExpose({ register })
</script>

<template>
    <nue-dropdown
        placement="bottom-end"
        size="small"
        @execute="(executeId: string) => execute(executeId)"
        theme="menu"
        group="tasks-operations-dropdown"
    >
        <template #trigger="{ trigger }">
            <slot name="trigger" :trigger="trigger">
                <nue-button icon="more" theme="icon,ghost" @click="trigger" />
            </slot>
        </template>
        <slot></slot>
    </nue-dropdown>
</template>
