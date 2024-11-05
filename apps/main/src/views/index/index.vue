<template>
    <nue-container id="IndexView" theme="horizontal">
        <index-header></index-header>
        <router-view></router-view>
    </nue-container>
</template>

<script setup lang="ts">
import { IndexHeader } from '@nao-todo/layers'
import { useViewStore } from '@nao-todo/stores'

const { indexViewInitTask } = useViewStore()

await indexViewInitTask()
</script>
