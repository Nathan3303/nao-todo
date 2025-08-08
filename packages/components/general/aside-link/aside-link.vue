<template>
    <nue-link theme="rl" :route="routeName ? { name: routeName } : void 0" v-bind="$attrs">
        <slot />
        <template #append>
            <slot name="append" />
        </template>
    </nue-link>
</template>

<script setup lang="ts">
defineOptions({ name: 'AsideLink' })
defineProps<{ routeName?: string }>()
</script>
