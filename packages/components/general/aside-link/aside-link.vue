<template>
    <nue-link theme="btnlike,plink" v-bind="$attrs">
        <slot />
        <template #append>
            <slot name="append" />
        </template>
    </nue-link>
</template>

<script setup lang="ts">
defineOptions({ name: 'AsideLink' })
</script>
