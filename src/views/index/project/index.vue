<template>
    <nue-main aside-width="200px">
        <template #aside>
            <project-aside></project-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { ProjectAside } from '@/layers/index';
</script>
