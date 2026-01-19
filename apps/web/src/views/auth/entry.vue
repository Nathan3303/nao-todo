<script lang="ts" setup>
import { AuthViewAside, AuthViewContent } from '@/layouts/auth'
import useAuthView from './auth-view'

defineOptions({ name: 'AuthView' })

const { isDisplayAside } = useAuthView()
</script>

<template>
    <nue-container>
        <nue-main>
            <auth-view-aside v-if="isDisplayAside" />
            <auth-view-content />
        </nue-main>
    </nue-container>
</template>

