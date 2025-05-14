<template>
    <nue-container theme="vertical,inner">
        <nue-main
            :allow-collapse-aside="false"
            :allow-hide-aside="false"
            :allow-resize-aside="responsiveFlag > 1"
            aside-max-width="300px"
            aside-min-width="200px"
            @after-aside-resize="tasksLayoutStore.handleAfterAsideResize"
            :aside-width="asideWidth"
        >
            <template #aside>
                <aside-link
                    v-for="(link, index) in routeLinks"
                    :icon="link.icon"
                    :key="index"
                    :route="link.route"
                    theme="btnlike,plink"
                >
                    {{ link.name }}
                </aside-link>
            </template>
            <template #content>
                <router-view></router-view>
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { AsideLink } from '@nao-todo/components'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { useTasksLayoutStore } from '@/views/tasks'

const viewStore = useViewStore()
const tasksLayoutStore = useTasksLayoutStore()

const { responsiveFlag } = storeToRefs(viewStore)
const { asideWidth } = storeToRefs(tasksLayoutStore)

const routeLinks = [
    { name: '用户信息', icon: 'user', route: '/settings/profile' },
    { name: '修改密码', icon: 'lock', route: '/settings/password' }
]
</script>

<style>
.settings-view__form-row {
    gap: 0.5rem;
    flex-direction: column;
    width: min(100%, 32rem);
    align-items: stretch;
}
</style>

