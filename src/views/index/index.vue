<template>
    <nue-container id="global" class="app-container">
        <app-header></app-header>
        <nue-main aside-width="200px">
            <template #aside>
                <app-aside></app-aside>
            </template>
            <template #content>
                <router-view></router-view>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { AppHeader, AppAside } from '@/components'
</script>
