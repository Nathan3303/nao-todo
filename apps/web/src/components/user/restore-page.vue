<script setup lang="ts">
import { useUserUseCase } from '@/hooks'
import { UserRestore, useUserStore } from '@nao-todo/presentation/user'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

defineOptions({ name: 'UserRestorePage' })

const router = useRouter()

const userStore = useUserStore()
const userUseCase = useUserUseCase(userStore)
const { deletionDeadline } = storeToRefs(userStore)

const handleRestored = async () => {
    await router.replace('/auth/signin')
}

const handleConfirmUnrestore = () => {
    localStorage.setItem('CONFIRM_UNRESTORE', 'True')
    router.push('/tasks')
}
</script>

<template>
    <user-restore
        :user-use-case="userUseCase"
        :deletion-deadline="deletionDeadline"
        @restored="handleRestored"
        @confirm-unrestore="handleConfirmUnrestore"
    />
</template>

