<template>
    <nue-container>
        <nue-main>
            <auth-aside v-if="isDisplayAside" />
            <auth-content />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { AuthAside, AuthContent } from '@/layouts/auth'
import useAuthViewStore from './auth-view-store'

defineOptions({ name: 'AuthView' })

const authViewStore = useAuthViewStore()

const { isDisplayAside } = storeToRefs(authViewStore)
</script>
