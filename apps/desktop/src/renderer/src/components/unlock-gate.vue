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
import {
    cryptoService,
    deletionService,
    initSnowflakeEpoch,
    localSession,
    readCachedNickname,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure'
import { useUserStore, UserInitialAvatar } from '@nao-todo/presentation-identity'
import { useUserUseCase } from '@/hooks'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvatarSrc, Loading as LoadingComp, t } from '@nao-todo/shared'
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
        localSession.setCurrentUserId(currentUserId)
        userId.value = currentUserId
        cachedNickname.value = readCachedNickname() ?? ''
        // 冷启动（已有 JWT）：刷新后端雪花 Epoch（失败回退缓存/默认，不阻塞）
        void initSnowflakeEpoch()
        // 注销反悔期到期：清空该用户本地数据（密钥包一并删除，按全新用户放行）
        await deletionService.checkAndCleanExpired(currentUserId)
        // 无密钥包 = 该用户首次使用，直接放行（首次登录时由 signIn 建立密钥包）
        const hasBundle = await cryptoService.hasKeyBundle(currentUserId)
        phase.value = 'ready'
        if (!hasBundle) {
            emit('unlocked')
            return
        }
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

const onUnlock = async () => {
    if (!password.value) {
        error.value = '请输入密码'
        return
    }
    if (!userId.value) {
        error.value = '无法识别当前用户，请重新登录'
        return
    }
    unlocking.value = true
    error.value = ''
    try {
        await cryptoService.unlock(userId.value, password.value)
        emit('unlocked')
    } catch {
        error.value = '密码错误，无法解锁本地数据'
    } finally {
        unlocking.value = false
    }
}

/**
 * 登出当前用户：清 JWT/本地会话/内存密钥，放行后由 App 引导至登录页
 */
const onSignOut = () => {
    NueConfirm({
        title: '确认登出吗？',
        content: '登出后将清除本次会话密钥，需重新登录才能访问本地数据。',
        confirmButtonText: '登出',
        cancelButtonText: '取消',
        onConfirm: () => {
            userStore.clearAuthData()
            localSession.clear()
            cryptoService.lock()
            emit('unlocked')
        }
    })
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
                <nue-content @keydown.enter="onUnlock">
                    <form autocomplete="off" name="NaoTodoUnlockForm">
                        <nue-div vertical>
                            <nue-input
                                v-model="password"
                                :disabled="unlocking"
                                allow-show-password
                                placeholder="输入密码解锁"
                                type="password"
                            />
                            <nue-button
                                :loading="unlocking"
                                :disabled="unlocking"
                                theme="primary"
                                type="submit"
                                @click="onUnlock"
                            >
                                解锁
                            </nue-button>
                            <nue-button
                                :disabled="unlocking"
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
}
</style>