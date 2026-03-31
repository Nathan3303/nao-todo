<script setup lang="ts">
import { Loading as LoadingComponent } from '@nao-todo/components'
import { inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { NueMessage } from 'nue-ui'
import { AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AuthViewContext } from '@/views/auth/types'

const router = useRouter()
const { authUseCase } = inject<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY)!

onMounted(() => {
    // const err = await
    // if (err !== null) {
    //     NueMessage.error(unwrapError(err))
    //     return router.replace('/auth/signin')
    // }
    // router.replace('/tasks')
    authUseCase
        .checkIn()
        .then((err) => {
            if (err === null) return
            NueMessage.error(unwrapError(err))
            router.replace('/auth/signin')
        })
        .finally(() => router.replace('/tasks'))
})
</script>

<template>
    <nue-container id="AuthViewMainContentCheckIn">
        <nue-main>
            <nue-content>
                <loading-component placeholder="正在验证用户凭证 ..." />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#AuthViewMainContentCheckIn {
    align-items: center;
    justify-content: center;
    gap: 1.75rem;

    > .nue-header {
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }

    > .nue-main {
        width: 20rem;
        border: none;
        height: auto;
        align-items: center;
        justify-content: center;
        flex: none;
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }
}
</style>
