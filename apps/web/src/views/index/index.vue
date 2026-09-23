<script lang="ts" setup>
import { onMounted } from 'vue'
import useIndexView from './index-view'
import { AppDialogAdapter, AppAsideV2Adapter } from '@/components/app/'
import { showPlaintextNoticeConfirm } from '@/components/plaintext-notice'
import { Loading as LoadingComp, assetUrl } from '@nao-todo/shared'
import { UserDeletionNotifier } from '@nao-todo/presentation-identity'

defineOptions({ name: 'AppContainer' })

const { isLoading, IndexViewInitialize } = useIndexView()

onMounted(() => {
    IndexViewInitialize()
    // 首启明文告知：一次性 NueConfirm（设备级已读标记；替代原常驻横幅，不占头部）
    showPlaintextNoticeConfirm()
})
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <app-aside-v2-adapter />
            <nue-content fill style="overflow: hidden">
                <!-- 头部零挂载（用户裁定）：明文告知走首启 NueConfirm；只读提示走写拦截时 NueMessage；
                     离线/镜像/覆盖度状态已全部迁入左下角同步状态组件（T115b/r7） -->
                <!-- 路由视图 -->
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #pending>
                            <loading-comp height="100%" />
                        </template>
                        <template #fallback>
                            <nue-empty
                                :image-src="assetUrl('/images/error.webp')"
                                image-size="6rem"
                            >
                                <nue-text size="var(--nue-text-sm)">
                                    应用加载失败, 请刷新页面重试
                                </nue-text>
                            </nue-empty>
                        </template>
                    </suspense>
                </router-view>
                <!-- 任务视图对话框 -->
                <app-dialog-adapter />
                <!-- 用户待注销状态通知 -->
                <user-deletion-notifier />
            </nue-content>
        </nue-main>
    </nue-container>
</template>