<template>
    <li class="nue-dropdown-item" :data-execute-id="executeId">
        <nue-icon :name="icon" />
        {{ title }}
        <nue-icon v-if="checked" name="check" />
    </li>
</template>

<script setup lang="ts">
import type { InnerDropdownOptionProps } from './types'

defineProps<InnerDropdownOptionProps>()
</script>

<style scoped></style>
