<template>
    <nue-link theme="btnlike,plink" v-bind="$attrs">
        <slot></slot>
        <template #append>
            <slot name="append"></slot>
        </template>
    </nue-link>
</template>

<script setup lang="ts">
defineOptions({ name: 'AsideLink' })
</script>

<style scoped>
@import url('./aside-link.css');
</style>
