<template>
    <loading-screen
        :loading="indexViewLoader.loading"
        :error="indexViewLoader.error"
        :error-message="indexViewLoader.errorMessage"
        @refresh="indexViewInitTask"
    />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { useViewStore } from '@/stores'
import { LoadingScreen } from '@nao-todo/components'

const { indexViewLoader, indexViewInitTask } = useViewStore()
</script>

<style>
html,
body {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
}

#app {
    width: 100%;
    height: 100%;
}
</style>
