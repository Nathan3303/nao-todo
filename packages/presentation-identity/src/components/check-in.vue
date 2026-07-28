<script setup lang="ts">
import { type GoError, Loading as LoadingComponent, unwrapError } from '@nao-todo/shared'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { AuthUseCase, USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'

defineOptions({ name: 'AuthCheckIn' })
const props = defineProps<{ authUseCase: AuthUseCase; loadingText: string }>()
const emit = defineEmits<{ (e: 'checkInSuccess'): void }>()

const router = useRouter()

props.authUseCase
    .checkIn(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) || '')
    .then((err: GoError) => {
        if (err === null) {
            emit('checkInSuccess')
            return null
        }
        NueMessage.error(unwrapError(err))
        return router.replace('/auth/signin')
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