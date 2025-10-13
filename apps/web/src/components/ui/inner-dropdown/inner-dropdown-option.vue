<template>
    <li :data-executeid="executeId" :data-disabled="disabled">
        <nue-icon :name="icon as never" size="14px" />
        {{ title }}
        <nue-div theme="append">
            <nue-icon v-if="checked" name="check" style="margin-left: auto" />
        </nue-div>
    </li>
</template>

<script setup lang="ts">
import type { InnerDropdownOptionProps } from './types'

defineProps<InnerDropdownOptionProps>()
</script>

<style scoped>
li[data-disabled='true'] {
    background-color: var(--nue-disabled-color);
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
