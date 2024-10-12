<template>
    <nue-header style="position: relative">
        <template #logo>
            <img
                class="logo"
                src="/favicon.ico"
                alt="logo"
                style="width: 24px; aspect-ratio: 1; margin-top: 6px; cursor: pointer"
                @click.stop="showUpdateLogDialog"
            />
        </template>
        <template #navigators>
            <nue-tooltip size="small" content="任务" placement="right-center">
                <nue-link theme="btnlike,plink" icon="square-check-fill" route="/tasks" />
            </nue-tooltip>
            <nue-tooltip size="small" content="日历" placement="right-center">
                <nue-link theme="btnlike,plink" icon="calendar2" disabled />
            </nue-tooltip>
        </template>
        <template #user>
            <user-dropdown :user="user" @logout="handleLogout" />
        </template>
    </nue-header>
    <update-log-dialog ref="updateLogDialogRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NueConfirm } from 'nue-ui'
import { UserDropdown } from '@/components/user'
import { UpdateLogDialog } from '../update-log-dialog'
import { useUserStore } from '@/stores'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'AppHeader' })

const router = useRouter()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)
const updateLogDialogRef = ref<InstanceType<typeof UpdateLogDialog>>()

const showUpdateLogDialog = () => {
    updateLogDialogRef.value?.show()
}

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
