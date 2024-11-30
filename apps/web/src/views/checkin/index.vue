<template>
    <nue-container class="checkin-view"></nue-container>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useUserStore, useViewStore } from '@/stores'

const props = defineProps<{ fromUrlBase64: string }>()

const router = useRouter()
const userStore = useUserStore()
const viewStore = useViewStore()

viewStore.indexViewLoader.loading = true

userStore.doCheckin().then((res) => {
    if (!res && !userStore.isAuthenticated) {
        viewStore.indexViewLoader.loading = false
        router.replace('/auth/login')
    } else {
        const to = atob(props.fromUrlBase64) || '/'
        router.replace(to)
    }
})
</script>
