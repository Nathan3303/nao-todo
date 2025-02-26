<script setup lang="ts">
import type { InnerDropdownEmits, InnerDropdownProps } from './types'

withDefaults(defineProps<InnerDropdownProps>(), {
    title: '选项标题',
    icon: 'plus-circle'
})
const emit = defineEmits<InnerDropdownEmits>()

const handleDropdownExecute = (executeId: string) => {
    emit('execute', executeId)
}
</script>

<template>
    <nue-dropdown
        nesting
        hide-on-clicked
        placement="right-start"
        @execute="handleDropdownExecute"
        size="small"
    >
        <template #default="{ clickTrigger }">
            <li class="nue-dropdown-item" @click.stop="clickTrigger">
                <nue-icon :name="icon" />
                {{ title }}
                <nue-icon name="arrow-right" style="margin-left: auto" />
            </li>
        </template>
        <template #dropdown>
            <slot></slot>
        </template>
    </nue-dropdown>
</template>

<style scoped></style>
