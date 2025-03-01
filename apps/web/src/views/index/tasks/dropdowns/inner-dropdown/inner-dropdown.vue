<template>
    <nue-dropdown
        nesting
        :hide-on-clicked="hideOnClicked"
        placement="right-start"
        @execute="handleDropdownExecute"
        size="small"
        :disabled="disabled"
        ref="InnerDropdownRef"
    >
        <li
            class="nue-dropdown-item"
            :data-disabled="disabled"
            @click="handleToggleDropdown"
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
        <template #dropdown>
            <slot></slot>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import useDropdownController from './use-dropdown-controller'
import { NueDropdown } from 'nue-ui'
import type { InnerDropdownEmits, InnerDropdownProps } from './types'

const props = withDefaults(defineProps<InnerDropdownProps>(), {
    title: '选项标题',
    icon: 'plus-circle',
    hideOnClicked: false,
    suffix: 0,
    disabled: false,
    groupName: 'default'
})
const emit = defineEmits<InnerDropdownEmits>()

const { bind, unBind, hideOthers } = useDropdownController()
const InnerDropdownRef = ref<InstanceType<typeof NueDropdown>>()

const handleDropdownExecute = (executeId: string) => {
    emit('execute', executeId)
}

const handleToggleDropdown = () => {
    if (!InnerDropdownRef.value) return
    if (!InnerDropdownRef.value.visible) hideOthers(props.groupName)
    InnerDropdownRef.value.toggle()
}

onMounted(() => bind(props.groupName, InnerDropdownRef))
onBeforeUnmount(() => unBind(props.groupName, InnerDropdownRef))
</script>

<style scoped>
.nue-dropdown-item[data-disabled='true'] {
    background-color: #e2e2e2;
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
