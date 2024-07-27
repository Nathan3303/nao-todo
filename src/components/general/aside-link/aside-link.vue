<template>
    <nue-link theme="btnlike,plink" v-bind="$attrs">
        <slot></slot>
    </nue-link>
</template>

<script setup lang="ts">
defineOptions({ name: 'AsideLink' })
</script>

<style scoped>
@import url('./aside-link.css');
</style>
