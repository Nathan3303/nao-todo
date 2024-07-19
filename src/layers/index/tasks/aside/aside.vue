<template>
    <nue-container class="tasks-view-aside" vertical>
        <!-- 侧边栏顶部 -->
        <nue-header>
            <nue-link theme="btnlike" icon="more2" :route="{ name: 'tasks-all' }">
                所有
            </nue-link>
            <nue-link theme="btnlike" icon="more2"> 今天 </nue-link>
            <nue-link theme="btnlike" icon="more2"> 明天 </nue-link>
            <nue-link theme="btnlike" icon="more2"> 最近 7 天 </nue-link>
            <nue-link theme="btnlike" icon="more2"> 收集箱 </nue-link>
        </nue-header>
        <!-- 侧边栏中部 -->
        <nue-main>
            <nue-collapse v-model="collapseItems">
                <nue-collapse-item name="project-list">
                    <template #header="{ collapse, state }">
                        <nue-button
                            theme="pure"
                            :icon="state ? 'arrow-right' : 'arrow-down'"
                            @click="collapse"
                        >
                            <template #default>
                                <nue-text size="12px">项目清单</nue-text>
                            </template>
                        </nue-button>
                    </template>
                    <nue-link theme="btnlike" icon="more2"> 项目一 </nue-link>
                    <nue-link theme="btnlike" icon="more2"> 项目二 </nue-link>
                </nue-collapse-item>
            </nue-collapse>
        </nue-main>
        <!-- 侧边栏底部 -->
        <nue-footer>
            <nue-link theme="btnlike" icon="more2"> 明天 </nue-link>
            <nue-link theme="btnlike" icon="more2"> 最近 7 天 </nue-link>
            <nue-link theme="btnlike" icon="more2"> 收集箱 </nue-link>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'TasksViewAside' })

const collapseItems = ref(['project-list'])
</script>

<style scoped>
@import url('./aside.css');
</style>
