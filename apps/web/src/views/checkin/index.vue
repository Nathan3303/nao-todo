<template>
    <nue-container id="CheckinViewContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <loading-comp />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useUserSettingsStore } from '@/stores/global'
import useAuthAppStore from '@nao-todo/application/auth'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { Loading as LoadingComp } from '@nao-todo/components'

const props = defineProps<{ fromUrlBase64: string }>()

const router = useRouter()
const authAppStore = useAuthAppStore()

watchEffect(async () => {
    const err = await authAppStore.checkIn()
    if (err) {
        NueMessage.error(unwrapError(err))
        await router.replace('/auth/signin')
        return
    }
    // 获取用户落地页，若用户未设置落地页，则跳转到任务页
    const userSettingsStore = useUserSettingsStore()
    const landingPage = userSettingsStore.userPreference.landingPage
    const callbackURL = atob(props.fromUrlBase64) || '/'
    if (callbackURL.includes('/' + landingPage) || !landingPage) {
        await router.replace(atob(props.fromUrlBase64))
        return
    }
    await router.replace({ name: landingPage })
})
</script>
