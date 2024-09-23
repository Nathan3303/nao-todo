<template>
        <index-header></index-header>
        <suspense>
            <router-view></router-view>
        </suspense>
</template>

<script setup lang="ts">
import { IndexHeader } from '@/layers'
import { useViewStore } from '@/stores'

const { indexViewInitTask } = useViewStore()

await indexViewInitTask()
</script>
