<template>
    <nue-dropdown
        placement="right-start"
        theme="menu"
        size="small"
        ref="InnerDropdownRef"
        :close-when-executed="closeWhenExecuted"
        :transparent="transparent"
        :disabled="disabled"
        :group="group"
        @execute="(executeId) => emit('execute', executeId)"
    >
        <template #trigger="{ trigger }">
            <li :data-disabled="disabled" @click="trigger">
                <nue-icon :name="icon" />
                <nue-text>{{ title }}</nue-text>
                <nue-div theme="append">
                    <span v-if="suffix" style="color: orange">{{ suffix }}</span>
                    <nue-icon size="var(--nue-text-xs)" name="arrow-right" />
                </nue-div>
            </li>
        </template>
        <nue-div theme="block">
            <slot></slot>
        </nue-div>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NueDropdown } from 'nue-ui'
import type { InnerDropdownEmits, InnerDropdownProps } from './types'

const props = withDefaults(defineProps<InnerDropdownProps>(), {
    title: '选项标题',
    icon: 'plus-circle',
    closeWhenExecuted: true,
    groupName: 'default',
    transparent: true
})
const emit = defineEmits<InnerDropdownEmits>()

const InnerDropdownRef = ref<InstanceType<typeof NueDropdown>>()

const suffix = computed(() => {
    if (!props.suffix) return ''
    else if (typeof props.suffix === 'number') return `+${props.suffix}`
    else return '!'
})
</script>

<style scoped>
.nue-dropdown-item[data-disabled='true'] {
    background-color: #e2e2e2;
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
