<template>
    <nue-header>
        <template #logo>
            <nue-link href="/">
                <nue-text size="26px">NaoTodo</nue-text>
            </nue-link>
        </template>
        <template #nav>
            <nue-div>
                <nue-link theme="btnlike" icon="projects" route="/project">Projects</nue-link>
                <nue-link theme="btnlike" icon="todo" route="/tasks" disabled>Tasks</nue-link>
            </nue-div>
        </template>
        <template #ops>
            <nue-div>
                <nue-button theme="icon-only" icon="search" disabled></nue-button>
                <nue-badge dot>
                    <nue-button theme="icon-only" icon="ring" disabled></nue-button>
                </nue-badge>
            </nue-div>
        </template>
        <template #user>
            <nue-dropdown trigger="hover" align="right">
                <nue-avatar
                    src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                ></nue-avatar>
                <template #dropdown>
                    <nue-div vertical align="center" justify="center" width="240px" gap="32px">
                        <nue-div vertical align="center">
                            <nue-avatar
                                src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                                size="64px"
                            ></nue-avatar>
                            <nue-text> {{ userStore.user?.nickName }} </nue-text>
                        </nue-div>
                        <nue-div vertical align="stretch" gap="8px">
                            <nue-link theme="btnlike" disabled>Profile</nue-link>
                            <nue-link theme="btnlike" disabled>Settings</nue-link>
                            <nue-divider></nue-divider>
                            <nue-link theme="btnlike" @click="handleLogout">Logout</nue-link>
                        </nue-div>
                    </nue-div>
                </template>
            </nue-dropdown>
        </template>
    </nue-header>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/use-user-token'
import { NueConfirm, NueMessage } from 'nue-ui'

defineOptions({ name: 'AppHeader' })
const emit = defineEmits<{
    (event: 'logout'): void
}>()

const userStore = useUserStore()

function handleLogout() {
    NueConfirm({
        title: 'Logout',
        content: 'Are you sure to logout?'
    }).then(
        () => emit('logout'),
        () => NueMessage.info('Operation canceled')
    )
}
</script>

<style scoped></style>
