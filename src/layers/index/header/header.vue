<template>
    <nue-header style="position: relative">
        <template #nav>
            <nue-div>
                <nue-link theme="btnlike,plink" icon="square-check-fill" route="/tasks">
                    任务
                </nue-link>
                <nue-link theme="btnlike,plink" icon="calendar2" disabled>日历</nue-link>
            </nue-div>
        </template>
        <nue-link href="/" style="position: absolute; left: 50%; transform: translateX(-50%)">
            <nue-text size="26px">NaoTodo</nue-text>
        </nue-link>
        <template #user>
            <user-dropdown :user="user" @logout="handleLogout" />
        </template>
    </nue-header>
</template>

<script setup lang="ts">
import { NueConfirm } from 'nue-ui'
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
        title: '退出登录',
        content: '确认退出当前账户吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
    }).then(
        async () => {
            await userStore.signout()
            router.push('/authentication/login')
        },
        () => {}
    )
}
</script>
