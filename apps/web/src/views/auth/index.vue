<template>
    <nue-container id="AuthViewContainer">
        <nue-main>
            <auth-view-main-aside v-if="isDisplayAside" />
            <auth-view-main-content />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { useViewStore } from '@/stores/global'
import { storeToRefs } from 'pinia'
import useAuthViewStore from './use-auth-view-store'
import AuthViewMainAside from './main/aside.vue'
import AuthViewMainContent from './main/content/index.vue'

const viewStore = useViewStore()
const authViewStore = useAuthViewStore()

const { isDisplayAside } = storeToRefs(authViewStore)

onMounted(() => {
    viewStore.hideFirstLoadingScreen()
})
</script>

<style scoped></style>
