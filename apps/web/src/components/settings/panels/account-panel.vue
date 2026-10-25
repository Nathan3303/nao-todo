<script setup lang="ts">
/**
 * 设置「账户」分类面板（T535）
 * @description 自上而下：用户信息（展示 + 编辑入口）→ 密码修改（按需展开表单）→ 登录设备
 *              → 独立危险区（退出登录 → 注销账户，注销在最末、不可逆）。
 *              行为零改动：用户信息/改密/会话/注销全部复用既有组件与用例，危险区只是换位置。
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC6 · R3）
 */
import { computed, inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NueConfirm } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import {
    USER_DEACTIVE_DIALOG_KEY,
    USER_RESTORE_DIALOG_KEY
} from '@nao-todo/shared/constants/dialog-keys'
import {
    UserDeactiveDialog,
    UserRestoreDialog,
    UserSessionManager,
    useUserStore
} from '@nao-todo/presentation-identity'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import { SettingsPasswordUpdater } from '../password-updater'
import { SettingsProfileUpdater } from '../profile-updater'
import { useSettingsSignOut } from '../use-settings-sign-out'

defineOptions({ name: 'SettingsAccountPanel' })

const router = useRouter()
const { userUseCase, dialogManager } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
const { signOut } = useSettingsSignOut()

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

// @state 改密表单按需展开（默认收起：面板保持可扫读；表单语义与既有组件逐字一致）
const passwordOpen = ref(false)

/** 冷却期内不可再次发起注销（沿用既有 deactive-manager 的 disabled 条件） */
const deactiveCooldown = computed(() => profile.value?.isInDeactiveCooldown === true)

/** 已进入待注销 ⇒ 危险区末行改为「撤销注销」（与 v1.12.16 deactive-manager 同分支） */
const deactivated = computed(() => !!profile.value?.deactivedAt)

const handleDeactivate = async (): Promise<void> => {
    const [isByCancel] = await NueConfirm({
        title: t('user.deactiveConfirmTitle'),
        content: t('user.deactiveConfirmContent'),
        confirmButtonText: t('user.deactiveConfirmButton'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    dialogManager.open(USER_DEACTIVE_DIALOG_KEY)
}

const handleRestore = (): void => {
    dialogManager.open(USER_RESTORE_DIALOG_KEY)
}

const handleDeactivated = async (): Promise<void> => {
    dialogManager.close(USER_DEACTIVE_DIALOG_KEY)
    await router.replace('/auth/signin')
}
</script>

<template>
    <div class="sd-cat" data-settings-category="account">
        <!-- 常规区：用户信息 → 密码 → 登录设备 -->
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.account.name') }}</h2>
                <p class="sd-group__desc">{{ t('settings.ia.account.desc') }}</p>
            </header>

            <div class="sd-row sd-row--block" data-setting-id="profile">
                <settings-profile-updater :show-sign-out="false" />
            </div>

            <div class="sd-row sd-row--stack" data-setting-id="password">
                <button
                    type="button"
                    class="sd-row__toggle"
                    :aria-expanded="passwordOpen"
                    @click="passwordOpen = !passwordOpen"
                >
                    <nue-icon name="lock" size="1rem" />
                    <span class="sd-row__label">{{ t('settings.password') }}</span>
                    <nue-icon
                        class="sd-row__chevron"
                        :name="passwordOpen ? 'arrow-up' : 'arrow-down'"
                        size="1rem"
                    />
                </button>
                <settings-password-updater v-if="passwordOpen" />
            </div>

            <div class="sd-row sd-row--block" data-setting-id="sessions">
                <user-session-manager :user-use-case="userUseCase" />
            </div>
        </section>

        <!-- 危险区：独立容器、位于常规区之后且类内末位；每行独立二次确认 -->
        <section class="sd-group sd-group--danger" data-settings-zone="danger">
            <header class="sd-group__head">
                <h3 class="sd-group__title">{{ t('settings.dangerZone') }}</h3>
                <p class="sd-group__desc">{{ t('settings.ia.danger.desc') }}</p>
            </header>

            <button
                type="button"
                class="sd-danger-row"
                data-setting-id="sign-out"
                data-setting-danger
                @click="signOut"
            >
                <nue-icon name="arrow-left-more" size="1rem" />
                <span>{{ t('settings.signOutButtonText') }}</span>
            </button>

            <button
                v-if="!deactivated"
                type="button"
                class="sd-danger-row"
                data-setting-id="deactivate"
                data-setting-danger
                :disabled="deactiveCooldown"
                @click="handleDeactivate"
            >
                <nue-icon name="delete" size="1rem" />
                <span>{{ t('settings.deactive.title') }}</span>
            </button>
            <button
                v-else
                type="button"
                class="sd-danger-row"
                data-setting-id="deactivate"
                data-setting-danger
                :disabled="deactiveCooldown"
                @click="handleRestore"
            >
                <nue-icon name="restore" size="1rem" />
                <span>{{ t('user.restoreWarningTitle') }}</span>
            </button>
        </section>

        <!-- 注销/撤销注销弹层：宿主在本面板（触发器与弹层同层，行为与既有 deactive-manager 一致） -->
        <user-restore-dialog :user-use-case="userUseCase" :dialog-manager="dialogManager" />
        <user-deactive-dialog
            :user-use-case="userUseCase"
            :dialog-manager="dialogManager"
            @deactivated="handleDeactivated"
        />
    </div>
</template>