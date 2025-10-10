<template>
    <nue-div align="center" width="fit-content">
        <nue-input
            v-model="filterInfo.name"
            icon="filter"
            theme="small"
            clearable
            placeholder="筛选标签"
            :debounce-time="360"
        />
    </nue-div>
</template>

<script setup lang="ts">
import useTagManagerStore from './use-tag-manager-store'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TagManagerFilterBar' })

const tagManagerStore = useTagManagerStore()

const { filterInfo } = storeToRefs(tagManagerStore)
</script>

<style scoped></style>
