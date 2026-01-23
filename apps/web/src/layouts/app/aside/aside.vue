<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { NaoRouterLink } from '@/components/ui'
import useUserStore from '@nao-todo/application/web/stores/user-store'
import useAppStore from '@/views/app-store'

defineOptions({ name: 'AppAside' })

const userStore = useUserStore()
const appStore = useAppStore()

const { profile } = storeToRefs(userStore)
const { routerLinks } = storeToRefs(appStore)
</script>

<template>
    <nue-div v-if="profile" theme="aside-wrapper">
        <nue-tooltip
            placement="right-center"
            size="small"
            :content="`你好👋，${profile.nickname}！`"
        >
            <nue-avatar :src="profile.avatar" size="2.5rem" />
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
        <nue-div theme="aside__actions"></nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div.nue-div--aside-wrapper {
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    height: 100%;

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
</style>

