<template>
    <loading-screen :loading="loading"></loading-screen>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { LoadingScreen } from '@/components/general/loading-screen'
import { useLoadingScreen } from '@/hooks/use-loading-screen'

const { loading } = useLoadingScreen()
</script>
