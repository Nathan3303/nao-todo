<script lang="ts" setup>
import { AuthViewAside } from '@/layouts/auth'
import useAuthView from './auth-view'

defineOptions({ name: 'AuthView' })

const authView = useAuthView()
</script>

<template>
    <nue-container>
        <nue-main>
            <auth-view-aside v-if="authView.isDisplayAside" />
            <nue-content fill>
                <router-view />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

