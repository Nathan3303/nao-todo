<template>
    <nue-container theme="vertical,inner">
        <nue-header>
            <nue-text>设置 - 账户设置</nue-text>
        </nue-header>
        <nue-main>
            <nue-div vertical gap="1rem">
                <nue-div wrap="nowrap" align="center" justify="space-between">
                    <nue-div align="center" flex="1">
                        <nue-text color="gray" size="12px">用户 ID</nue-text>
                        <nue-tooltip
                            content="该用户在 NaoTodo 上的唯一标识"
                            placement="right-center"
                            size="small"
                        >
                            <nue-icon color="gray" name="help" size="14px" />
                        </nue-tooltip>
                    </nue-div>
                    <nue-div align="center" width="75%">
                        <nue-text size="14px">{{ userStore.user?.id }}</nue-text>
                    </nue-div>
                </nue-div>
                <nue-div wrap="nowrap" align="center" justify="space-between">
                    <nue-text color="gray" size="12px">注册时间</nue-text>
                    <nue-div align="center" width="75%">
                        <nue-text size="14px">
                            {{
                                useMoment(userStore.user?.createdAt).format(
                                    'YYYY年MM月DD日 HH时mm分'
                                )
                            }}
                        </nue-text>
                    </nue-div>
                </nue-div>
                <nue-divider />
                <nue-div wrap="nowrap" align="center" justify="space-between">
                    <nue-button disabled>注销该账户</nue-button>
                </nue-div>
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { useMoment } from '@nao-todo/utils'
import { useUserStore } from '@/stores'

defineOptions({ name: 'SettingsAccount' })

const userStore = useUserStore()
</script>

<style scoped></style>
