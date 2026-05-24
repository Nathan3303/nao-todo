<script setup lang="ts">
import type { InnerDropdownOptionProps } from './types'

defineOptions({ name: 'InnerDropdownOption' })
defineProps<InnerDropdownOptionProps>()
</script>

<template>
    <nue-dropdown-item
        :theme="color"
        :icon="icon"
        :execute-id="executeId"
        :disabled="disabled"
        :text="title"
        size="small"
    >
        <template #append>
            <slot>
                <nue-icon v-if="checked" name="check" />
            </slot>
        </template>
    </nue-dropdown-item>
</template>

<style scoped>
.nue-dropdown-item--red {
    color: var(--nue-error-color-70);
    background-color: var(--nue-error-color-10);

    &:hover {
        color: var(--nue-error-color-90);
        background-color: var(--nue-error-color-20);
    }
}

.nue-dropdown-item--orange {
    color: var(--nue-warning-color-70);
    background-color: var(--nue-warning-color-10);

    &:hover {
        color: var(--nue-warning-color-90);
        background-color: var(--nue-warning-color-20);
    }
}
</style>

