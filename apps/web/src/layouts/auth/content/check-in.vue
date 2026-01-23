<script setup lang="ts">
import { Loading as LoadingComponent } from '@nao-todo/components'
import { inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { NueMessage } from 'nue-ui'
import { AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AuthViewContext } from '@/views/auth/auth-view'

const router = useRouter()
const authViewContext = inject<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY)!

onMounted(async () => {
    const err = await authViewContext.checkInExecutor()
    if (err) {
        NueMessage.error(unwrapError(err))
        router.replace('/auth/signin')
        return
    }
    const fromUrl = router.currentRoute.value.query.fromUrl as string
    router.replace(fromUrl === '/' ? '/tasks' : fromUrl)
})
</script>

<template>
    <nue-container id="AuthViewMainContentCheckIn">
        <nue-main>
            <nue-content>
                <loading-component />
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
