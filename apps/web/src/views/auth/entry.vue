<script lang="ts" setup>
import useAuthView from './auth-view'
import { Loading as LoadingCompnent, t } from '@nao-todo/shared'

defineOptions({ name: 'AuthView' })

const { isDisplayAside } = useAuthView()
</script>

<template>
    <nue-container theme="auth-view">
        <nue-main>
            <nue-aside v-if="isDisplayAside" min-width="256px" max-width="512px" width="480px">
                <nue-div flex="1" justify="space-between" vertical>
                    <nue-text color="var(--nue-primary-color-0)" size="2rem">NaoTodo</nue-text>
                    <nue-text color="var(--nue-primary-color-0)" size="1rem">
                        {{ t('auth.aside.tagline') }}
                    </nue-text>
                </nue-div>
            </nue-aside>
            <nue-content fill>
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #fallback>
                            <loading-compnent height="100%" />
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container--auth-view > .nue-main > .nue-aside {
    background-color: var(--nue-primary-color-900);
}
</style>