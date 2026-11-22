<script setup lang="ts">
/**
 * 设置「账户」分类面板（T535 / #360）
 * @description 面板头（`账户` h2 + 一句说明）之下**四个平级分区**，每区一律
 *              = 组头（`h3.sd-group__title` 20/600）+ 一句副标题（`.sd-group__desc`）+ 内容：
 *              ① 资料（头像 + 昵称/邮箱/注册时间 + 昵称编辑）② 密码（常驻展开、**无底色**）
 *              ③ 登录设备（组件内同名小标题隐藏，标题由分区组头承担）④ 危险区（退出登录 →
 *              注销/撤销注销 → 待注销时的数据删除时间，不可逆动作在最末）。
 *              #360：删「更多信息」分组（注册时间归位到身份区第三行、待注销时间迁到危险区末行）；
 *              密码由折叠升为常驻分区；T752：四分区化（组头 + 副标题）+ 密码分区去底色（B 方案）。
 *              行为零改动：改密/会话/注销全部复用既有组件与用例。
 * @see docs/prds/2026-11-22-settings-polish.md（AC2 / AC3 / AC5 / AC6）
 * @see docs/designs/360-settings-polish.md（§1 四分区 / §3c 密码分区无底色 / §3d L2-L6）
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC6 · R3）
 */
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NueConfirm } from 'nue-ui'
import dayjs from 'dayjs'
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

/** 冷却期内不可再次发起注销（沿用既有 deactive-manager 的 disabled 条件） */
const deactiveCooldown = computed(() => profile.value?.isInDeactiveCooldown === true)

/** 已进入待注销 ⇒ 危险区末行改为「撤销注销」（与 v1.12.16 deactive-manager 同分支） */
const deactivated = computed(() => !!profile.value?.deactivedAt)

/**
 * 数据删除时间 = 停用日 − 7 天（沿用既有计算与格式 `YYYY-MM-DD HH:mm:ss`）。
 * 待注销才渲染；缺失 ⇒ 空串（整行不渲染，不留空行 / 空标签，AC5）。
 */
const deletionDeadline = computed<string>(() => {
    const deactivedAt = profile.value?.deactivedAt
    if (!deactivedAt) return ''
    return dayjs(deactivedAt).subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss')
})

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
        <!-- 常规区：资料 → 密码 → 登录设备（三个分区同构：`sd-subblock` 组头 + 内容；
             块间距 = `sd-subblock` 的 24，唯一来源，⛔ 不自带 margin） -->
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.account.name') }}</h2>
                <p class="sd-group__desc" data-settings-desc>{{ t('settings.ia.account.desc') }}</p>
            </header>

            <!-- ① 资料分区：组头复用 `settings.profile`（⛔ 不为分区头另造新键） -->
            <header class="sd-group__head sd-subblock" data-settings-section="profile">
                <h3 class="sd-group__title">{{ t('settings.profile') }}</h3>
                <p class="sd-group__desc">{{ t('settings.ia.profile.desc') }}</p>
            </header>
            <div class="sd-row sd-row--block" data-setting-id="profile">
                <settings-profile-updater :show-sign-out="false" />
            </div>

            <!-- ② 密码分区（AC3）：常驻展开、零点击即见三个输入框；**无底色 / 无内边距 / 无圆角**
                 （B 方案：分区重量只由「组头字阶 + 块间距」两通道承担，⛔ 不加描边 / 阴影 / 字号） -->
            <header class="sd-group__head sd-subblock" data-settings-section="password">
                <h3 class="sd-group__title">{{ t('settings.password') }}</h3>
                <p class="sd-group__desc">{{ t('settings.ia.password.desc') }}</p>
            </header>
            <div class="sd-row sd-row--block" data-setting-id="password">
                <settings-password-updater />
            </div>

            <!-- ③ 登录设备分区：由组内尾块升为独立分区；同名小标题由组头承担（组件内已移除） -->
            <header class="sd-group__head sd-subblock" data-settings-section="devices">
                <h3 class="sd-group__title">{{ t('settings.sessionTitle') }}</h3>
                <p class="sd-group__desc">{{ t('settings.ia.devices.desc') }}</p>
            </header>
            <div class="sd-row sd-row--block" data-setting-id="sessions">
                <user-session-manager :user-use-case="userUseCase" />
            </div>
        </section>

        <!-- ④ 危险区：独立容器、位于常规区之后且类内末位；每行独立二次确认 -->
        <section class="sd-group sd-group--danger" data-settings-zone="danger">
            <header class="sd-group__head" data-settings-section="danger">
                <h3 class="sd-group__title">{{ t('settings.dangerZone') }}</h3>
                <p class="sd-group__desc" data-settings-desc>{{ t('settings.ia.danger.desc') }}</p>
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

            <!-- 待注销时才出现的末行（AC6）：数据删除时间；不满足条件整行不渲染（AC5） -->
            <div v-if="deletionDeadline" class="sd-row" data-setting-deletion-deadline>
                <span class="sd-row__label sd-deletion-deadline">
                    {{ t('settings.restore.deletionDeadline', { date: deletionDeadline }) }}
                </span>
            </div>
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