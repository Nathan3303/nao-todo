<script lang="ts" setup>
import { reactive, ref, shallowRef } from 'vue'
import { useUserStore } from '@/stores'
import { NueDiv } from 'nue-ui'
import moment from 'moment'

defineOptions({ name: 'UserProfileDialog' })

const userStore = useUserStore()

const visible = ref(false)
const user = shallowRef({ ...userStore.user })
const updatingFlags = reactive({
    nickname: false
})

defineExpose({
    show: () => (visible.value = true)
})
</script>

<template>
    <nue-dialog v-model="visible" theme="user-profile" title="用户信息">
        <nue-div gap="24px" width="360px">
            <!--            <nue-div justify="center">-->
            <!--                <nue-avatar :src="user?.avatar" rounded size="72px" />-->
            <!--            </nue-div>-->
            <nue-div align="stretch" gap="4px" vertical>
                <nue-text color="gray" size="12px">用户昵称</nue-text>
                <template v-if="updatingFlags.nickname">
                    <nue-div align="center" gap="8px">
                        <nue-input
                            v-model="user.nickname"
                            :readonly="!updatingFlags.nickname"
                            theme="small"
                        />
                        <nue-button theme="small" @click="updatingFlags.nickname = false">
                            更新
                        </nue-button>
                        <nue-button theme="small" @click="updatingFlags.nickname = false">
                            取消
                        </nue-button>
                    </nue-div>
                </template>
                <template v-else>
                    <nue-div align="center">
                        <nue-text size="14px">{{ user.nickname }}</nue-text>
                        <nue-button
                            icon="edit"
                            theme="icon-only,pure"
                            @click="updatingFlags.nickname = true"
                        />
                    </nue-div>
                </template>
            </nue-div>
            <nue-div align="stretch" gap="4px" vertical>
                <nue-div align="center">
                    <nue-text color="gray" size="12px">用户 ID</nue-text>
                    <nue-tooltip
                        content="该用户在 NaoTodo 上的唯一标识"
                        placement="right-center"
                        size="small"
                    >
                        <nue-icon color="gray" name="help" size="14px" />
                    </nue-tooltip>
                </nue-div>
                <nue-text size="14px">{{ user.id }}</nue-text>
            </nue-div>
            <nue-div align="stretch" gap="4px" vertical>
                <nue-div align="center">
                    <nue-text color="gray" size="12px">用户角色</nue-text>
                    <nue-tooltip
                        content="该用户在 NaoTodo 上的所属角色"
                        placement="right-center"
                        size="small"
                    >
                        <nue-icon color="gray" name="help" size="14px" />
                    </nue-tooltip>
                </nue-div>
                <nue-text size="14px">
                    {{ user.role === 'user' ? 'NaoTodo 个人用户' : '其他角色' }}
                </nue-text>
            </nue-div>
            <nue-div align="stretch" gap="4px" vertical>
                <nue-text color="gray" size="12px">注册时间</nue-text>
                <nue-text size="14px">
                    {{ moment(user.createdAt).format('YYYY年MM月DD日 HH时mm分') }}
                </nue-text>
            </nue-div>
        </nue-div>
    </nue-dialog>
</template>

<style>
.nue-dialog--user-profile {
    gap: 24px;
}
</style>
