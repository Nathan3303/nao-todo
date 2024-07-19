<template>
    <nue-container id="global" class="app-container">
        <!-- 主页头部 -->
        <index-header></index-header>
        <!-- 主页内容 -->
        <nue-main>
            <suspense>
                <router-view></router-view>
            </suspense>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { IndexHeader } from '@/layers/index'
</script>
