<script setup lang="ts">
/**
 * 设置「账户」分类中的用户信息行（SHELL-05 / T535 / #360）
 * @description 头像 + 身份区三行（昵称 / 邮箱 / 注册时间）+ 昵称编辑入口。
 *              #360 AC2/AC5：删「更多信息」分组（与 `UserInfoViewer`），注册时间归位到身份区第三行；
 *              离线（profile=null）时用昵称缓存占位（仅展示、**不得**用于鉴权，SHELL-03 C-19）；
 *              注册时间缺失（离线 / 未就绪）时整行不渲染，不留空行 / 空标签。
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

/** 身份区第三行（AC2/AC5）：注册时间 + 已格式化的 `createdAt`（⛔ 不另做格式化）；缺失 ⇒ 空串 */
const registeredAtText = computed(() => {
    const createdAt = profile.value?.createdAt
    if (!createdAt) return ''
    return `${t('settings.registeredAt')} ${createdAt}`
})
</script>

<template>
    <div class="settings-profile">
        <user-avatar-updater :user-use-case="userUseCase">
            <div class="settings-profile__identity">
                <div class="settings-profile__names">
                    <nue-text v-if="displayNickname" size="lg">
                        {{ displayNickname }}
                    </nue-text>
                    <nue-text v-if="profile" size="sm" color="gray">
                        {{ profile.email }}
                    </nue-text>
                    <nue-text v-else size="sm" color="gray">
                        {{ t('identity.offline') }}
                    </nue-text>
                    <!-- 第三行：注册时间（缺失 / 离线 ⇒ 不渲染，不留空行） -->
                    <nue-text v-if="registeredAtText" size="sm" color="gray">
                        {{ registeredAtText }}
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
    gap: var(--nue-gap-2xs);
}

.settings-profile__field {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}
</style>