<script lang="ts" setup>
import useSearchViewStore from './search-view-store'

defineOptions({ name: 'SearchView' })

const searchViewStore = useSearchViewStore()
</script>

<template>
    <nue-div v-if="searchViewStore" align="center" height="100%" justify="center">
        <nue-empty description="搜索视图筹备中" />
    </nue-div>
</template>

<style scoped></style>
