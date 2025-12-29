<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { NaoRouterLink } from '@/components/ui'
import useAppStore from '@/views/app-store'
import { computed } from 'vue'

defineOptions({ name: 'AppAside' })

const appStore = useAppStore()

const { routerLinks } = storeToRefs(appStore)

const userProfile = computed(() => appStore.userApp.states.profile)
</script>

<template>
    <nue-div v-if="userProfile" theme="aside-wrapper">
        <nue-tooltip
            placement="right-center"
            size="small"
            :content="`你好👋，${userProfile.nickname}！`"
        >
            <nue-avatar :src="userProfile.avatar" size="2.5rem" />
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
