<template>
    <nue-container id="global" class="app-container">
        <loading-screen
            :loading="indexViewLoader.loading"
            :error="indexViewLoader.error"
            :error-message="indexViewLoader.errorMessage"
            @refresh="indexViewInitTask"
        />
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { LoadingScreen } from '@/components/general/loading-screen'
import { useViewStore } from '@/stores'

const { indexViewLoader, indexViewInitTask } = useViewStore()
</script>
