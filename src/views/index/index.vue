<template>
    <nue-container id="global" class="app-container">
        <app-header @logout="handleLogout"></app-header>
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { AppHeader } from '@/layers/index'
import { useUserStore } from '@/stores/use-user-store'
import { useRouter } from 'vue-router'


const router = useRouter()
const userStore = useUserStore()

async function handleLogout() {
    const res = await userStore.signout()
    if (res) {
        router.push('/authentication/login')
    }
}
</script>
