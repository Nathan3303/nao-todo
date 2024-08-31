<template>
    <nue-container id="global" class="app-container">
        <index-header-layer></index-header-layer>
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { IndexHeaderLayer } from '@/layers/index'
</script>
