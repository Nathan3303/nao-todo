<script setup lang="ts">
/**
 * web 首拉门（PS-16）—— 非阻塞覆盖层
 * @description web 无 desktop 的 `InitialSyncGate`；业务读路径切本地后「本地空 ⇒ 首屏空」。
 *              本组件在**本地镜像缺失且在线**时覆盖加载态，等待首次拉取完成或超时放行
 *              （超时后由同步状态面显示 C-60③「尚未同步完成」）。
 *              覆盖而非卸载 `<App/>`：web 的 requester 由 `App.vue` setup 初始化，
 *              卸载会形成「门等同步、同步等 requester」死锁。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（PS-16）
 */
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@nao-todo/shared/components/loading'
import { waitForFirstPullGate } from '@/views/auth/first-pull-gate'

defineOptions({ name: 'InitialPullGate' })

const route = useRoute()
const waiting = ref(false)
/** 运行序号：路由连续变化时丢弃过期判定，避免旧判定覆盖新状态 */
let seq = 0

const run = async (): Promise<void> => {
    // 认证页（未登录/登录中）不拦
    if (route.path.startsWith('/auth')) {
        waiting.value = false
        return
    }
    const mine = ++seq
    await waitForFirstPullGate({
        onWait: () => {
            if (mine === seq) waiting.value = true
        }
    })
    if (mine === seq) waiting.value = false
}

onMounted(() => {
    void run()
})
watch(
    () => route.path,
    () => {
        void run()
    }
)
</script>

<template>
    <div v-if="waiting" class="initial-pull-gate">
        <Loading height="100vh" placeholder="正在同步数据…" />
    </div>
</template>

<style scoped>
.initial-pull-gate {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--nue-color-bg, #ffffff);
}
</style>