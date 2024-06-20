<template>
    <nue-container id="global" class="app-container">
        <app-header @logout="handleLogout"></app-header>
        <suspense>
            <router-view></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { provide } from 'vue'
import { storeToRefs } from 'pinia'
import { AppHeader } from '@/layers/index'
import { useUserStore } from '@/stores/use-user-token'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/use-project-store'

const router = useRouter()
const userStore = useUserStore()
const projectStore = useProjectStore()

await projectStore.getProjects()

const { user } = storeToRefs(userStore)

async function handleLogout() {
    const res = await userStore.signout()
    if (res) {
        router.push('/authentication/login')
    }
}

provide('user', { user })
</script>
