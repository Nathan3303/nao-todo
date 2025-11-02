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
            <nue-dropdown-item
                :icon="icon"
                :disabled="disabled"
                :text="title"
                use-suffix-icon
                @click="!disabled && trigger($event)"
            >
                <template #append>
                    <nue-text v-if="suffix" color="orange" size="var(--nue-text-sm)">
                        {{ suffix }}
                    </nue-text>
                </template>
            </nue-dropdown-item>
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

defineOptions({ name: 'InnerDropdown' })
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

