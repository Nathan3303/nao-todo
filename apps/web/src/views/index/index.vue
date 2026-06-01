<script lang="ts" setup>
import { onMounted } from 'vue'
import useIndexView from './index-view'
import { AppDialogAdapter } from '@/layouts/app/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'AppContainer' })

const { isLoading, IndexViewInitialize } = useIndexView()

onMounted(() => IndexViewInitialize())
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <!-- 路由视图 -->
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #pending>
                            <loading-comp height="100%" />
                        </template>
                        <template #fallback>
                            <nue-empty image-src="/images/error.webp" image-size="6rem">
                                <nue-text size="var(--nue-text-sm)">
                                    应用加载失败, 请刷新页面重试
                                </nue-text>
                            </nue-empty>
                        </template>
                    </suspense>
                </router-view>
                <!-- 任务视图对话框 -->
                <app-dialog-adapter />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

