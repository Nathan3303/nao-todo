<template>
    <nue-header>
        <template #nav>
            <nue-div>
                <nue-link theme="btnlike" icon="projects" route="/project">Projects</nue-link>
                <nue-link theme="btnlike" icon="todo" route="/tasks">Tasks</nue-link>
            </nue-div>
        </template>
        <nue-link href="/">
            <nue-text size="26px">NaoTodo</nue-text>
        </nue-link>
        <template #ops>
            <nue-div>
                <nue-button theme="icon-only" icon="search" disabled></nue-button>
                <nue-badge dot>
                    <nue-button theme="icon-only" icon="ring" disabled></nue-button>
                </nue-badge>
            </nue-div>
        </template>
        <template #user>
            <user-dropdown :user="user" @logout="handleLogout"></user-dropdown>
        </template>
    </nue-header>
</template>

<script setup lang="ts">
import { NueConfirm, NueMessage } from 'nue-ui'
import { UserDropdown } from '@/components/user'
import { useUserStore } from '@/stores'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'AppHeader' })

const router = useRouter()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)

const handleLogout = () => {
    NueConfirm({
        title: 'Logout',
        content: 'Are you sure to logout?'
    }).then(
        async () => {
            await userStore.signout()
            router.push('/authentication/login')
        },
        () => NueMessage.info('Operation canceled')
    )
}
</script>
