<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { UserRestore, useUserStore } from '@nao-todo/presentation/user'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'UserRestorePage' })

const router = useRouter()
const { userUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const userStore = useUserStore()
const { deletionDeadline } = storeToRefs(userStore)

const handleRestored = async () => {
    await router.replace('/auth/signin')
}
</script>

<template>
    <nue-container>
        <nue-header>
            <nue-text>撤销注销</nue-text>
        </nue-header>
        <nue-main>
            <nue-content>
                <user-restore
                    :user-use-case="userUseCase"
                    :deletion-deadline="deletionDeadline"
                    @restored="handleRestored"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

