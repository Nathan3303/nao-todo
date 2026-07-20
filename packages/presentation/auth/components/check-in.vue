<script setup lang="ts">
import { type GoError, Loading as LoadingComponent, unwrapError } from '@nao-todo/shared'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { AuthUseCase } from '@nao-todo/application/auth/usecases'

defineOptions({ name: 'AuthCheckIn' })
const props = defineProps<{ authUseCase: AuthUseCase; loadingText: string }>()

const router = useRouter()

props.authUseCase
    .checkIn()
    .then((err: GoError) => {
        if (err === null) return null
        NueMessage.error(unwrapError(err))
        return router.replace('/auth/signin')
    })
    .then(() => {
        const lastRoute = localStorage.getItem('LAST_VISITED_ROUTE')
        router.replace(lastRoute || '/tasks')
    })
</script>

<template>
    <nue-container id="AuthCheckIn">
        <loading-component :placeholder="loadingText" />
    </nue-container>
</template>

<style scoped>
#AuthCheckIn {
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
