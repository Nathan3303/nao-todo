<template>
    <loading-screen
        :loading="indexViewLoader.loading"
        :error="indexViewLoader.error"
        :error-message="indexViewLoader.errorMessage"
        @refresh="indexViewInitTask"
    />
    <nue-container id="global" class="app-container">
        <index-header></index-header>
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { LoadingScreen } from '@/components/general/loading-screen'
import { IndexHeader } from '@/layers'
import { useViewStore } from '@/stores'

const { indexViewLoader, indexViewInitTask } = useViewStore()

indexViewInitTask()
</script>
