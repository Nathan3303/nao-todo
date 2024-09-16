<template>
    <nue-container id="global" class="app-container">
        <index-header></index-header>
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { IndexHeader } from '@/layers'
</script>
