<script setup lang="ts">
import { reactive, ref } from 'vue'
import { pingServerByXHR } from '@/stores/global'
import { NueMessage } from 'nue-ui'
import { debounce } from '@nao-todo/utils'

defineOptions({ name: 'OfflineScreen' })

const visible = ref(false)
const loading = ref(false)
const emptyAttrs = reactive({
    image: '/images/wifi-offline.webp',
    description: '当前网络错误，请检查网络连接'
})

// @method 检测服务器连接
const pingServer = async () => {
    console.log(1)
    loading.value = true
    const ok = await pingServerByXHR()
    loading.value = false
    if (ok) {
        visible.value = false
        NueMessage.success('成功重新连接至服务器')
    } else {
        visible.value = true
        NueMessage.error('连接服务器失败')
        emptyAttrs.image = '/images/disconnect.webp'
        emptyAttrs.description = '服务器连接失败，请检查网络设置或稍后再试'
    }
    return ok
}

// @methods 重试 / 重试节流
const debounceRetry = debounce(() => pingServer(), 360)

// @block 检测浏览器是否支持 navigator.connection - 用于检测当前网络状态
if ('connection' in navigator) {
    const connection =
        navigator.connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection

    if (connection) {
        connection.addEventListener('change', debounceRetry)
    } else {
        console.warn('[OfflineScreen] Error:', 'navigator.connection API 不可用')
    }
}
</script>

<template>
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
                @click="debounceRetry"
                style="margin: 1rem"
            >
                尝试重连
            </nue-button>
        </nue-empty>
    </nue-div>
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
</style>
