<script setup lang="ts">
/**
 * 解锁门（本地数据解锁）—— SHELL-03 终态完备化
 * @description 总函数：任何路径都必须进入且仅进入一个显式终态 ∈ {checking, ready, error}
 *              （C-01：`v-else` 兜底，禁止"无匹配 ⇒ 渲染空"）。
 *              就绪判据**只用本地事实**（JWT 解析 + 密钥包 + 本地库；C-04），网络 profile 只在
 *              ready 之后异步加载、失败静默（C-03），缺失时身份区降级：缓存昵称首字母头像（离线）
 *              → 无缓存则通用图标占位（C-18/C-20）；失败终态恒含「重试」+「登出」（C-02）。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */
import { cryptoService } from '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service'
import { initSnowflakeEpoch } from '@nao-todo/infrastructure/src/persistence-sync/epoch'
import {
    isPlaintextMigrationDone,
    runPlaintextMigration
} from '@nao-todo/infrastructure/src/persistence-local/migration/plaintext-migration'
import {
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { readCachedNickname } from '@nao-todo/infrastructure/src/persistence-local/session/profile-cache'
import { useUserStore, UserInitialAvatar } from '@nao-todo/presentation-identity'
import { useUserUseCase } from '@/hooks'
import { wipeLocalDataOnSignOut } from '@/views/auth/sign-out-wipe'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvatarSrc } from '@nao-todo/shared/utils/avatar'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { t } from '@nao-todo/shared/locales'
import { NueConfirm } from 'nue-ui'

defineOptions({ name: 'UnlockGate' })

const emit = defineEmits<{ (e: 'unlocked'): void }>()

const userStore = useUserStore()
const { profile, userToken } = storeToRefs(userStore)

/** 终态机（C-01/C-13：checking / ready / error 三态穷尽） */
type UnlockPhase = 'checking' | 'ready' | 'error'

const phase = ref<UnlockPhase>('checking')
const password = ref('')
const error = ref('')
const unlocking = ref(false)
const migrating = ref(false)
/** 有历史密文库且尚未明文迁移 ⇒ 需密码解锁并（可选）升级；未迁移即 UI 标「待升级」（AC4） */
const migrationPending = ref(false)
const userId = ref<string | null>(null)
/** 离线昵称缓存（解锁前可读；SHELL-03 C-15…C-21） */
const cachedNickname = ref('')

// @computed 身份呈现（C-03/C-18：profile 有则真值，无则缓存首字母/图标占位）
const isOffline = computed(() => !profile.value?.nickname)
const displayNickname = computed(() => profile.value?.nickname ?? cachedNickname.value)
const avatarSrc = computed(() => getAvatarSrc(profile.value?.avatar || '', userToken.value))
const identityLabel = computed(() => {
    const name = displayNickname.value
    if (!name) return ''
    return isOffline.value ? t('identity.offlineName', { name }) : name
})

/**
 * 本地就绪判据（C-04：亚秒级、不依赖网络）
 * @description 失败（本地库/密钥包读取异常）⇒ error 终态（重试 + 登出）
 */
const checkLocal = async (): Promise<void> => {
    phase.value = 'checking'
    error.value = ''
    try {
        // 从已保存的 JWT 解析当前用户；未登录（无 JWT）直接放行到登录页
        const currentUserId = resolveUserIdFromStoredJwt()
        if (!currentUserId) {
            phase.value = 'ready'
            emit('unlocked')
            return
        }
        // 注：`localSession` 重建与注销到期清理已收敛至 `bootstrapLocalData`（C-61；AppRoot 渲染门前 await）
        userId.value = currentUserId
        cachedNickname.value = readCachedNickname() ?? ''
        // 冷启动（已有 JWT）：刷新后端雪花 Epoch（失败回退缓存/默认，不阻塞）
        void initSnowflakeEpoch()
        // 无密钥包 = 该用户首次使用，直接放行（首次登录时由 signIn 建立密钥包）
        const hasBundle = await cryptoService.hasKeyBundle(currentUserId)
        // 已有密钥包但已完成明文迁移 ⇒ 无需密码直接进入（AC1b/AC2：重启后不再需要密码）
        const migrated = hasBundle ? await isPlaintextMigrationDone(currentUserId) : false
        phase.value = 'ready'
        if (!hasBundle || migrated) {
            emit('unlocked')
            return
        }
        // 有历史密文库且未迁移：保留一次性迁移提示入口（C-51；长期保留，本仓无遥测）
        migrationPending.value = true
    } catch (localErr) {
        console.error('[desktop] 解锁门本地检查失败', localErr)
        error.value = '本地数据检查失败，请重试或重新登录'
        phase.value = 'error'
    }
}

/**
 * 拉取用户资料（C-03：就绪后异步、失败静默；成功时由装配层写入昵称缓存，C-21）
 */
const loadProfile = async (): Promise<void> => {
    try {
        const [vo] = await useUserUseCase(userStore).loadUserProfile()
        if (vo?.nickname) cachedNickname.value = vo.nickname
    } catch {
        // 离线/后端不可达：静默（身份区保持缓存首字母或图标占位）
    }
}

onMounted(async () => {
    await checkLocal()
    // 本地就绪后异步取 profile：不阻塞解锁 UI（网络最坏 15.9s 见 ADR §1.3）
    if (phase.value === 'ready') void loadProfile()
})

/** 密码解锁（不含迁移）；成功返回 true */
const doUnlock = async (): Promise<boolean> => {
    if (!password.value) {
        error.value = '请输入密码'
        return false
    }
    if (!userId.value) {
        error.value = '无法识别当前用户，请重新登录'
        return false
    }
    unlocking.value = true
    error.value = ''
    try {
        await cryptoService.unlock(userId.value, password.value)
        return true
    } catch {
        error.value = '密码错误，无法解锁本地数据'
        return false
    } finally {
        unlocking.value = false
    }
}

/** 仅解锁（保留历史密文，UI 持续标「待升级」） */
const onUnlock = async () => {
    if (await doUnlock()) emit('unlocked')
}

/** 解锁并完成明文迁移（C-47/C-56：迁移在启动门内、主界面挂载前完成） */
const onUnlockAndMigrate = async () => {
    if (!(await doUnlock())) return
    if (!userId.value) return
    migrating.value = true
    error.value = ''
    try {
        await runPlaintextMigration(userId.value)
        emit('unlocked')
    } catch (migrateErr) {
        console.error('[desktop] 本地明文迁移失败', migrateErr)
        error.value = '本地数据迁移失败，请重试或选择稍后升级'
    } finally {
        migrating.value = false
    }
}

/** 回车提交：待迁移时走「解锁并升级」 */
const onSubmit = (): void => {
    if (migrationPending.value) void onUnlockAndMigrate()
    else void onUnlock()
}

/**
 * 登出当前用户：清 JWT/本地会话/内存密钥，放行后由 App 引导至登录页
 * @description C-54/C-52：清认证前先跑脏队列护栏 + `wipeUserData`（与 `AppRoot.onSignOut` 同口径）。
 *              本门位于 AppRoot 之前，`userId` 取自本地检查结果（`checkLocal` 已置）；
 *              本地检查失败（`userId` 为空）⇒ 跳过清库。护栏取消 ⇒ 中止（保留会话与本地数据）。
 */
const onSignOut = async () => {
    const [isByCancel] = await NueConfirm({
        title: '确认登出吗？',
        content: '登出后将清除本次会话密钥，需重新登录才能访问本地数据。',
        confirmButtonText: '登出',
        cancelButtonText: '取消'
    })
    if (isByCancel) return
    if (userId.value && !(await wipeLocalDataOnSignOut(userId.value))) return
    userStore.clearAuthData()
    localSession.clear()
    cryptoService.lock()
    emit('unlocked')
}
</script>

<template>
    <nue-container class="unlock-gate" theme="unlock-gate">
        <!-- ① 本地检查中（亚秒级，C-04） -->
        <template v-if="phase === 'checking'">
            <loading-comp placeholder="正在检查本地数据 ..." />
        </template>
        <!-- ② 可解锁（profile 有则真值、无则缓存首字母/图标占位；离线显示「离线」小字） -->
        <template v-else-if="phase === 'ready'">
            <nue-header>
                <nue-div align="center" gap="0.5rem" vertical>
                    <user-initial-avatar
                        :nickname="displayNickname"
                        :src="avatarSrc"
                        :label="identityLabel"
                        size="4rem"
                    />
                    <nue-text v-if="displayNickname" weight="bold" size="1.25rem">
                        {{ displayNickname }}
                    </nue-text>
                    <nue-text v-if="isOffline && displayNickname" class="unlock-gate__offline">
                        {{ t('identity.offline') }}
                    </nue-text>
                    <nue-text v-if="profile?.email" color="gray" size="0.875rem">
                        {{ profile.email }}
                    </nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content @keydown.enter="onSubmit">
                    <form autocomplete="off" name="NaoTodoUnlockForm">
                        <nue-div vertical>
                            <nue-text
                                v-if="migrationPending"
                                class="unlock-gate__pending"
                                size="0.875rem"
                            >
                                本地数据待升级：需输入密码完成明文迁移
                            </nue-text>
                            <nue-input
                                v-model="password"
                                :disabled="unlocking || migrating"
                                allow-show-password
                                placeholder="输入密码解锁"
                                type="password"
                            />
                            <nue-button
                                :loading="migrating || unlocking"
                                :disabled="unlocking || migrating"
                                theme="primary"
                                type="submit"
                                @click="onSubmit"
                            >
                                解锁
                            </nue-button>
                            <nue-button
                                v-if="migrationPending"
                                :disabled="unlocking || migrating"
                                size="small"
                                theme="pure"
                                @click="onUnlock"
                            >
                                跳过迁移
                            </nue-button>
                            <nue-button
                                :disabled="unlocking || migrating"
                                size="small"
                                theme="pure"
                                @click="onSignOut"
                            >
                                登出用户
                            </nue-button>
                        </nue-div>
                    </form>
                </nue-content>
            </nue-main>
            <nue-footer>
                <nue-text align="center" size="0.875rem" color="red">{{ error }}</nue-text>
            </nue-footer>
        </template>
        <!-- ③ 本地失败（C-02：重试 + 登出/重新登录；C-01：v-else 兜底，不落空） -->
        <template v-else>
            <nue-main>
                <nue-content>
                    <nue-div vertical align="center" gap="0.75rem">
                        <nue-text size="0.875rem">{{ error }}</nue-text>
                        <nue-button theme="primary" @click="checkLocal">重试</nue-button>
                        <nue-button size="small" theme="pure" @click="onSignOut">
                            登出用户
                        </nue-button>
                    </nue-div>
                </nue-content>
            </nue-main>
        </template>
    </nue-container>
</template>

<style scoped>
.nue-container--unlock-gate {
    align-items: center;
    justify-content: center;
    gap: var(--nue-gap-md);
    width: 20rem;
    height: 100vh;
    margin: 0 auto;

    > .nue-header {
        border: none;
        align-items: center;
        justify-content: center;
        height: auto;
    }

    > .nue-main {
        border: none;
        height: auto;
        align-items: center;
        justify-content: center;
        flex: none;

        .nue-button--pure {
            margin: 0 auto;
        }
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        align-items: center;
        justify-content: center;
        height: auto;
        min-height: 1.25rem;
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }

    /* 离线小字（C-18：解锁门用可见文案承载"离线"语义，i18n 键） */
    .unlock-gate__offline {
        color: var(--nue-secondary-text-color);
        font-size: var(--nue-text-sm);
    }

    /* 待升级提示（AC4：历史密文未迁移的可见标注） */
    .unlock-gate__pending {
        color: var(--nue-warning-color-60);
        text-align: center;
    }
}
</style>