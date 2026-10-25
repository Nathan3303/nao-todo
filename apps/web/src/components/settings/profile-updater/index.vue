<script setup lang="ts">
/**
 * 设置「账户」分类中的用户信息行（SHELL-05 / T535）
 * @description 头像 + 昵称/邮箱展示（离线时用昵称缓存占位，仅展示、**不得**用于鉴权，SHELL-03 C-19）
 *              + 昵称与更多资料的编辑入口。
 *              T535：会话管理、注销账户、退出登录各自独立成行/成区（见 `panels/account-panel.vue`），
 *              本组件只负责「用户信息」一件事。`showSignOut` 仅作兼容器（默认 `true`，既有独立用法与
 *              回归用例行为不变）；设置对话框内传 `false` —— 退出登录由危险区独立行承担，避免同一操作
 *              在面板内出现两次。
 */
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { t } from '@nao-todo/shared/locales'
import {
    UserAvatarUpdater,
    UserInfoViewer,
    UserNicknameUpdater,
    useUserStore
} from '@nao-todo/presentation-identity'
import { readCachedNickname } from '@nao-todo/infrastructure/src/persistence-local/session/profile-cache'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import { useSettingsSignOut } from '../use-settings-sign-out'

defineOptions({ name: 'SettingsProfileUpdater' })

const { userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
const { signOut } = useSettingsSignOut()

// @props `showSignOut`：默认 true（既有行为不变）；设置对话框内传 false（由危险区独立行承担）
withDefaults(defineProps<{ showSignOut?: boolean }>(), { showSignOut: true })

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

/** G14：离线 profile 缺失时复用 SHELL-03 昵称缓存做展示占位；邮箱等缺失字段留空 */
const offlineNickname = computed(() => (profile.value ? '' : readCachedNickname() || ''))
const displayNickname = computed(() => profile.value?.nickname || offlineNickname.value)
</script>

<template>
    <div class="settings-profile">
        <user-avatar-updater :user-use-case="userUseCase">
            <div class="settings-profile__identity">
                <div class="settings-profile__names">
                    <nue-text v-if="displayNickname" size="1.25rem">
                        {{ displayNickname }}
                    </nue-text>
                    <nue-text v-if="profile" size=".875rem" color="gray">
                        {{ profile.email }}
                    </nue-text>
                    <nue-text v-else size=".875rem" color="gray">
                        {{ t('identity.offline') }}
                    </nue-text>
                </div>
                <nue-button
                    v-if="showSignOut"
                    @click="signOut"
                    icon="arrow-left-more"
                    theme="small"
                >
                    {{ t('settings.signOutButtonText') }}
                </nue-button>
            </div>
        </user-avatar-updater>

        <div class="settings-profile__field">
            <nue-text>{{ t('settings.nickname') }}</nue-text>
            <user-nickname-updater :user-use-case="userUseCase" />
        </div>

        <div class="settings-profile__field">
            <nue-text>{{ t('settings.moreInfo') }}</nue-text>
            <user-info-viewer />
        </div>
    </div>
</template>

<style scoped>
/* 平铺版式：无内边距盒、无分隔线（块与块靠留白分开），内容与其它行同一左轴线 */
.settings-profile {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-df);
}

.settings-profile__identity {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--nue-gap-xs);
    min-width: 0;
}

.settings-profile__names {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.settings-profile__field {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}
</style>