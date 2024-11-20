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
