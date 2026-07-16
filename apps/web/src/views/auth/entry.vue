<script lang="ts" setup>
import useAuthView from './auth-view'
import { Loading as LoadingCompnent } from '@nao-todo/shared'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'AuthView' })

const { isDisplayAside } = useAuthView()
</script>

<template>
    <nue-container>
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
