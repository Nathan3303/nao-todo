<template>
    <nue-container id="IndexView" theme="horizontal">
        <index-header></index-header>
        <router-view></router-view>
    </nue-container>
</template>

<script setup lang="ts">
import { IndexHeader } from '@/layers'
import { useViewStore } from '@/stores'

const { indexViewInitTask } = useViewStore()

await indexViewInitTask()
</script>
