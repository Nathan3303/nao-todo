<script setup lang="ts">
import type { InnerDropdownOptionProps } from './types'

defineOptions({ name: 'InnerDropdownOption' })
defineProps<InnerDropdownOptionProps>()
</script>

<template>
    <nue-dropdown-item :icon="icon" :execute-id="executeId" :disabled="disabled" :text="title">
        <template #append>
            <nue-icon v-if="checked" name="check" />
        </template>
    </nue-dropdown-item>
</template>

