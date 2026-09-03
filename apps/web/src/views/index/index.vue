<script lang="ts" setup>
import { onMounted } from 'vue'
import useIndexView from './index-view'
import { AppDialogAdapter, AppAsideV2Adapter } from '@/components/app/'
import { Loading as LoadingComp, assetUrl } from '@nao-todo/shared'
import { UserDeletionNotifier } from '@nao-todo/presentation-identity'

defineOptions({ name: 'AppContainer' })

const { isLoading, IndexViewInitialize } = useIndexView()

onMounted(() => {
    IndexViewInitialize()
})
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <app-aside-v2-adapter />
            <nue-content fill style="overflow: hidden">
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