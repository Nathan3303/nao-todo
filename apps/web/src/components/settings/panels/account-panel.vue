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
 *              T754（用户第三轮）：① 登录设备「刷新」移到该分区**组头右侧**（与 `h3` 同一行、右对齐），
 *              列表头不再有刷新（面板内**恰好 1 个**）；② 危险区两个动作收进**一个 `nue-div`**、
 *              改为 `nue-button` 水平排列（危险/恢复语义用库标准 `destructive` / `primary`）。
 *              行为零改动：改密/会话/注销全部复用既有组件与用例，危险区文案与确认流程不变。
 * @see docs/prds/2026-11-22-settings-polish.md（AC2 / AC3 / AC5 / AC6）
 * @see docs/designs/360-settings-polish.md（§1 四分区 / §3c 密码分区无底色 / §3d L2-L6）
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC6 · R3）
 */
import { computed, inject, shallowRef } from 'vue'
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
 * 登录设备组件暴露的**最小面**：只有 `refresh()`（T754）
 * @description 依赖方向不变（设置面板 → `presentation-identity`，⛔ 包内不反向依赖本面板）；
 *              节流（2s）在组件内，这里只转发点击。
 */
type SessionManagerHandle = { refresh?: () => void }
const sessionManagerHandle = shallowRef<SessionManagerHandle | null>(null)

/** 函数 ref：拿到设备列表实例（卸载时置空；桩组件没有该方法也不会报错） */
const setSessionManager = (el: unknown): void => {
    sessionManagerHandle.value = (el as SessionManagerHandle | null) ?? null
}

/** 组头刷新按钮 ⇒ 转发到列表组件的 `refresh()`（已节流 2s） */
const handleRefreshSessions = (): void => {
    sessionManagerHandle.value?.refresh?.()
}

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

            <!-- ③ 登录设备分区：由组内尾块升为独立分区；同名小标题由组头承担（组件内已移除）。
                 T754：刷新按钮从列表头移到**本组头右侧**（与 `h3` 同一行、右对齐）——
                 节流 2s / 图标 / `title` 语义由列表组件暴露的 `refresh()` 与库按钮共同保留 -->
            <header
                class="sd-group__head sd-subblock sd-group__head--actions"
                data-settings-section="devices"
            >
                <h3 class="sd-group__title">{{ t('settings.sessionTitle') }}</h3>
                <p class="sd-group__desc">{{ t('settings.ia.devices.desc') }}</p>
                <nue-button
                    class="sd-group__head-action"
                    icon="refresh"
                    theme="icon,ghost,small"
                    data-setting-action="refresh-sessions"
                    :title="t('settings.sessionRefresh')"
                    @click="handleRefreshSessions"
                />
            </header>
            <div class="sd-row sd-row--block" data-setting-id="sessions">
                <user-session-manager :user-use-case="userUseCase" :ref="setSessionManager" />
            </div>
        </section>

        <!-- ④ 危险区：独立容器、位于常规区之后且类内末位；每行独立二次确认 -->
        <section class="sd-group sd-group--danger" data-settings-zone="danger">
            <header class="sd-group__head" data-settings-section="danger">
                <h3 class="sd-group__title">{{ t('settings.dangerZone') }}</h3>
                <p class="sd-group__desc" data-settings-desc>{{ t('settings.ia.danger.desc') }}</p>
            </header>

            <!-- 危险动作（T754）：**一个容器 + 两个 `nue-button`**，水平排列。
                 容器 = `nue-div`（flex row；间距 8 = `--nue-gap-xs`；窄屏 `wrap` 换行不溢出）；
                 危险/恢复语义用库标准主题 `destructive` / `primary`（DEF-64 既有归并口径，⛔ 不自造 theme）；
                 `data-setting-id` / `data-setting-danger` 留在**按钮**上（既有选择器契约不变）。 -->
            <nue-div class="sd-danger-actions" align="center" gap="var(--nue-gap-xs)" wrap="wrap">
                <nue-button
                    icon="arrow-left-more"
                    theme="destructive"
                    data-setting-id="sign-out"
                    data-setting-danger
                    @click="signOut"
                >
                    {{ t('settings.signOutButtonText') }}
                </nue-button>

                <nue-button
                    v-if="!deactivated"
                    icon="delete"
                    theme="destructive"
                    data-setting-id="deactivate"
                    data-setting-danger
                    :disabled="deactiveCooldown"
                    @click="handleDeactivate"
                >
                    {{ t('settings.deactive.title') }}
                </nue-button>
                <nue-button
                    v-else
                    icon="restore"
                    theme="primary"
                    data-setting-id="deactivate"
                    data-setting-danger
                    :disabled="deactiveCooldown"
                    @click="handleRestore"
                >
                    {{ t('user.restoreWarningTitle') }}
                </nue-button>
            </nue-div>

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