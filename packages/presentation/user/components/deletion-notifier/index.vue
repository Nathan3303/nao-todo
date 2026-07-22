<script setup lang="ts">
import { NueConfirm } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '../../stores'
import dayjs from 'dayjs'

defineOptions({ name: 'UserDeletionNotifierDialog' })

const { userDeletion } = storeToRefs(useUserStore())

const visible = ref<boolean>(false)
const deadlineDateString = computed(() => {
    return dayjs(userDeletion.value.deadline).format('YYYY年MM月DD日HH时mm分')
})

onMounted(() => {
    // const isConfirmUnrestore = localStorage.getItem('USER_CONFIRM_UNRESTORE') || false
    // visible.value = isConfirmUnrestore !== 'True' && userDeletion.value.isPending
    visible.value = userDeletion.value.isPending
    if (!visible.value) return
    NueConfirm({
        title: '用户处于待注销状态',
        content: `当前用户已执行注销操作，数据将会在 ${deadlineDateString.value} 删除，期间仍可使用。可以在
                    “设置” - “账户与个人信息” 页面中执行恢复账户（撤销注销）的操作。`,
        confirmButtonText: '我知道了',
        unuseCancelButton: true,
        onConfirm: () => {
            localStorage.setItem('USER_CONFIRM_UNRESTORE', 'True')
            visible.value = false
        }
    })
})
</script>

<template>
    <div v-if="visible" class="overlay">
        <nue-icon name="loading" spin />
    </div>
</template>

<style scoped>
.overlay {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>

