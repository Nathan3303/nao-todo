<script setup lang="ts">
import { useViewStore } from '@/stores/global'
import { useWindowResizeListener } from '@nao-todo/hooks'

defineOptions({ name: 'AppTopRouterView' })

const viewStore = useViewStore()
const { addCallback: addWindowResizeCb } = useWindowResizeListener()

// @window-resize 响应式检测 - 通过 window.innerWidth 和 window.resize 检测
addWindowResizeCb(viewStore.responsiveFlagUpdater, true)
</script>

<template>
    <suspense>
        <router-view />
    </suspense>
</template>
