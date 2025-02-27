<template>
    <li class="nue-dropdown-item" :data-executeid="executeId">
        <nue-icon :name="icon" size="14px" />
        {{ title }}
        <nue-icon v-if="checked" name="check" style="margin-left: auto" />
    </li>
</template>

<script setup lang="ts">
import type { InnerDropdownOptionProps } from './types'

defineProps<InnerDropdownOptionProps>()
</script>

<style scoped></style>
