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
import { useUserStoreV2, useUserSettingsStore } from '@/stores/global'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { useAxios } from '@nao-todo/hooks'
import { Loading as LoadingComp } from '@nao-todo/components'

const props = defineProps<{ fromUrlBase64: string }>()

const router = useRouter()
const userStore = useUserStoreV2()
const request = useAxios('http://localhost:3303/api/user')

watchEffect(async () => {
    const [res, err] = await userStore.checkin(request)
    if (err) {
        NueMessage.error(unwrapError(err))
        await router.replace('/auth/signin')
        return false
    }
    // 获取用户落地页，若用户未设置落地页，则跳转到任务页
    const userSettingsStore = useUserSettingsStore()
    const landingPage = userSettingsStore.userPreference.landingPage
    // console.log('landingPage', landingPage)
    if (landingPage) {
        await router.replace({ name: landingPage })
    } else {
        await router.replace(atob(props.fromUrlBase64) || '/')
    }
    return res
})
</script>

