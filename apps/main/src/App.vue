<template>
    <loading-screen
        :loading="indexViewLoader.loading"
        :error="indexViewLoader.error"
        :error-message="indexViewLoader.errorMessage"
        @refresh="indexViewInitTask"
    />
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { LoadingScreen } from '@nao-todo/components/general/loading-screen'
import { useViewStore } from '@nao-todo/stores'

const { indexViewLoader, indexViewInitTask } = useViewStore()
</script>
