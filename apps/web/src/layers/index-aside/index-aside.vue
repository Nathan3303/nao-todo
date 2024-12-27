<template>
    <nue-container class="index-aside" theme="vertical,inner">
        <nue-header height="70px">
            <user-dropdown
                :user="user"
                is-on-mobile
                placement="bottom-start"
                style="width: 100%"
                @logout="userStore.signOutWithConfirmation"
                @show-profile="showProfileDialog"
                @update-passwd="showUpdatePasswordDialog"
            />
        </nue-header>
        <nue-main>
            <aside-link icon="more2" route-name="tasks-all">所有</aside-link>
            <aside-link icon="calendar2" route-name="tasks-today">
                今天 - {{ now.format('MM月DD日, dddd') }}
            </aside-link>
            <aside-link icon="tomorrow2" route-name="tasks-tomorrow">明天</aside-link>
            <aside-link icon="week3" route-name="tasks-week">本周</aside-link>
            <aside-link icon="inbox" route-name="tasks-inbox">收集箱</aside-link>
            <nue-divider />
            <nue-collapse v-model="collapseItemsRecord">
                <project-smart-list />
                <tag-smart-list />
            </nue-collapse>
            <nue-divider />
            <aside-link icon="heart" route-name="tasks-favorite">已收藏</aside-link>
            <aside-link icon="delete" route-name="tasks-recycle">垃圾桶</aside-link>
            <nue-divider />
            <aside-link icon="focus2" route-name="fqfocus">番茄专注</aside-link>
            <aside-link icon="search2" route-name="search">搜索</aside-link>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { AsideLink, UserDropdown } from '@nao-todo/components'
import { ProjectSmartList, TagSmartList, UpdatePasswordDialog, UserProfileDialog } from '@/layers'
import { useMoment } from '@nao-todo/utils'
import { useUserStore, useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { onBeforeRouteUpdate } from 'vue-router'

const userStore = useUserStore()
const viewStore = useViewStore()

const now = useMoment()
const { user } = storeToRefs(userStore)
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()
const updatePasswordDialogRef = ref<InstanceType<typeof UpdatePasswordDialog>>()
const collapseItemsRecord = ref(['projects', 'tags'])

const showProfileDialog = () => userProfileDialogRef.value?.show()
const showUpdatePasswordDialog = () => updatePasswordDialogRef.value?.show()

onBeforeRouteUpdate((to, from, next) => {
    next()
    setTimeout(() => (viewStore.indexAsideVisible = false), 128)
})
</script>
