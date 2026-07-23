<script setup lang="ts">
import { APP_CONTEXT_KEY } from '@/context'
import { responsiveTypes } from '@nao-todo/shared'
import { computed, inject } from 'vue'
import AsideV2 from './aside-v2.vue'
import AsideV2Drawer from './aside-v2-drawer.vue'

defineOptions({ name: 'AppAsideV2Adapter' })

const { responsiveFlag } = inject(APP_CONTEXT_KEY)!

const isMobile = computed(() => responsiveFlag.value <= responsiveTypes.MOBILE)
</script>

<template>
    <!-- 使用抽屉式侧边栏 -->
    <aside-v2-drawer v-if="isMobile" />
    <!-- 使用正常占位侧边栏 -->
    <aside-v2 v-else />
</template>

<style src="./aside-v2.css"></style>

