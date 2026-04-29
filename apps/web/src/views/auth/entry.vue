<script lang="ts" setup>
import { AuthViewAside } from '@/layouts/auth'
import useAuthView from './auth-view'
import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'AuthView' })

const { isDisplayAside } = useAuthView()
</script>

<template>
    <nue-container>
        <nue-main>
            <auth-view-aside v-if="isDisplayAside" />
            <nue-content fill>
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #fallback>
                            <loading-comp height="100%" />
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

