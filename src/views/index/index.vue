<template>
    <nue-container id="global" class="app-container">
        <app-header></app-header>
        <router-view></router-view>
    </nue-container>
</template>

<script setup lang="ts">
import { AppHeader } from '@/layers/index'
</script>
