<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { pingServerByXHR, useUserStoreV2 } from '@/stores/global'
import { NueMessage } from 'nue-ui'
import { useMinuteTask } from '@nao-todo/hooks'

defineOptions({ name: 'OfflineScreen' })

const visible = ref(false)
const loading = ref(false)
const emptyAttrs = reactive({
    image: '/images/wifi-offline.webp',
    description: '当前网络错误，请检查网络连接'
})

// @method 检测服务器连接
const pingServer = async () => {
    loading.value = true
    const code = await pingServerByXHR()
    loading.value = false
    if (code > 10040 && code < 10050) {
        NueMessage.error('用户凭证失效，请重新登录')
        useUserStoreV2().signoutAndRedirect()
    }
    if (code) {
        visible.value = false
    } else {
        visible.value = true
        NueMessage.error('连接服务器失败')
        emptyAttrs.image = '/images/disconnect.webp'
        emptyAttrs.description = '服务器连接失败，请检查网络设置或稍后再试'
        stop()
    }
    return code
}

// @method 重试
const retry = async () => {
    const ok = await pingServer()
    if (!ok) return
    visible.value = false
    NueMessage.success('已连接服务器')
    run()
}

// @hook useMinuteTask
const { run, stop } = useMinuteTask(pingServer)

// onMounted
onMounted(() => run())
onBeforeUnmount(() => stop())
</script>

<template>
    <transition name="fade" mode="out-in" appear>
        <nue-div
            v-if="visible"
            align="center"
            justify="center"
            height="100vh"
            width="100vw"
            id="OfflineScreen"
        >
            <nue-empty
                :image-src="emptyAttrs.image"
                image-size="4rem"
                :description="emptyAttrs.description"
            >
                <nue-button
                    theme="small,primary"
                    :loading="loading"
                    @click="retry"
                    style="margin: 1rem"
                >
                    尝试重连
                </nue-button>
            </nue-empty>
        </nue-div>
    </transition>
</template>

<style scoped>
.nue-div#OfflineScreen {
    position: fixed;
    top: 0;
    left: 0;
    background-color: rgba(200, 200, 200, 0.88);
    z-index: 100;
    opacity: 1;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}
</style>
