<script setup lang="ts">
import { APP_CONTEXT_KEY } from '@/context'
import { PomodoroIndicator } from '@nao-todo/domain/pomodoro'
import { useUserStore } from '@nao-todo/domain/user'
import { NaoRouterLink, t } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'
import { env } from '@/env'

defineOptions({ name: 'AppAside' })

const userStore = useUserStore()

const { routerLinks } = inject(APP_CONTEXT_KEY)!

const { profile } = storeToRefs(userStore)
</script>

<template>
    <nue-div theme="app-aside">
        <nue-div v-if="profile" theme="aside-header">
            <nue-tooltip placement="right-start" size="small">
                <nue-avatar :src="`${env.baseURL}${profile.avatar}`" icon="user" size="2.5rem" />
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
                <template v-for="(rl, idx) in routerLinks" :key="idx">
                    <template v-if="rl.route === '/pomodoro'">
                        <pomodoro-indicator :route="rl.route" />
                    </template>
                    <template v-else>
                        <nue-tooltip
                            :key="idx"
                            :content="rl.name"
                            placement="right-center"
                            size="small"
                        >
                            <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                        </nue-tooltip>
                    </template>
                </template>
            </nue-div>
            <nue-div theme="aside__bottom">
                <nue-div theme="aside__actions" v-if="$slots.actions">
                    <slot name="actions"></slot>
                </nue-div>
                <!-- <pomodoro-timer-indicator /> -->
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

        .nue-div.nue-div--aside__bottom {
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }
    }
}
</style>
