<script setup lang="ts">
import type { InnerDropdownEmits, InnerDropdownProps } from './types'

withDefaults(defineProps<InnerDropdownProps>(), {
    title: '选项标题',
    icon: 'plus-circle',
    hideOnClicked: false,
    suffix: 0,
    disabled: false
})
const emit = defineEmits<InnerDropdownEmits>()

const handleDropdownExecute = (executeId: string) => {
    emit('execute', executeId)
}
</script>

<template>
    <nue-dropdown
        nesting
        :hide-on-clicked="hideOnClicked"
        placement="right-start"
        @execute="handleDropdownExecute"
        size="small"
        :disabled="disabled"
    >
        <template #default="{ clickTrigger }">
            <li
                class="nue-dropdown-item"
                :data-disabled="disabled"
                @click.stop="clickTrigger"
            >
                <nue-icon :name="icon" />
                {{ title }}
                <nue-text color="orange" style="margin-left: auto" size="12px">
                    <template v-if="suffix">
                        <template v-if="typeof suffix === 'number'">
                            {{ suffix }}
                        </template>
                        <template v-else> !</template>
                    </template>
                </nue-text>
                <nue-icon name="arrow-right" />
            </li>
        </template>
        <template #dropdown>
            <slot></slot>
        </template>
    </nue-dropdown>
</template>

<style scoped>
.nue-dropdown-item[data-disabled='true'] {
    background-color: #e2e2e2;
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
