<script setup lang="ts">
import type { TagCardProps } from './types'

defineOptions({ name: 'TagCard', inheritAttrs: false })
defineProps<TagCardProps>()
</script>

<template>
    <nue-div theme="card" align="center" justify="space-between" auto-fit>
        <nue-text :clamped="1">
            {{ tag.name }}
        </nue-text>
        <nue-div align="center">
            <slot name="ops" />
        </nue-div>
    </nue-div>
</template>