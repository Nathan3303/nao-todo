<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import { NaoRouterLink } from '@nao-todo/components'
import { useUserStore } from '@/stores'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AppContext } from '@/app'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'AppAside' })

const userStore = useUserStore()

const { routerLinks } = inject<AppContext>(APP_CONTEXT_KEY)!

const { profile } = storeToRefs(userStore)
</script>

<template>
    <nue-div theme="app-aside">
        <nue-div v-if="profile" theme="aside-header">
            <nue-tooltip placement="right-start" size="small">
                <nue-avatar :src="profile.avatar" size="2.5rem" />
                <template #content>
                    <nue-div vertical gap=".25rem">
                        <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-0)">
                            {{ t('welcome.greeting', { name: profile.nickname }) }}
                        </nue-text>
                        <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-0)">
                            {{ t('welcome.message') }}
                        </nue-text>
                    </nue-div>
                </template>
            </nue-tooltip>
            <nue-div theme="aside__navs">
                <nue-tooltip
                    v-for="(rl, idx) in routerLinks"
                    :key="idx"
                    :content="rl.name"
                    placement="right-center"
                    size="small"
                >
                    <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                </nue-tooltip>
            </nue-div>
            <nue-div theme="aside__actions" v-if="$slots.actions">
                <slot name="actions"></slot>
            </nue-div>
        </nue-div>
        <slot></slot>
    </nue-div>
</template>

<style scoped>
.nue-div--app-aside {
    width: 100%;
    height: 100%;
    overflow: hidden;
    gap: 0;
    padding: 0;

    > .nue-div.nue-div--aside-header {
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        width: 70px;
        padding: var(--nue-padding-df);
        height: 100%;

        &:deep() + div {
            border-left: 1px solid var(--nue-border-color);
        }

        .nue-div.nue-div--aside__navs {
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
            flex: auto;
        }

        .nue-div.nue-div--aside__actions {
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
        }
    }
}
</style>

