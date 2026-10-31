<script setup lang="ts">
/**
 * 用户检入（凭据校验）—— SHELL-03 附录 B-3 / C-01/C-02/C-24
 * @description 失败分支两条硬判据：
 *              ① **路由判据**：失败处理前先判当前路由仍是 `auth-checkin`，否则**静默 return**
 *                 （消除"用户已选择离线进入离开本页后，旧的失败 promise 把应用拖回登录页"的竞态）；
 *              ② **失败分类**：**网络类**（断网/超时/5xx）**不得** `replace('/auth/signin')`（离线必败=死路），
 *                 改为**可重试失败态**（含「重试」+「重新登录」两个可前进动作，C-02）；
 *                 **凭证类**（401/403/10041/登录已过期）保持 `replace('/auth/signin')`。
 */
import { Loading as LoadingComponent } from '@nao-todo/shared/components/loading'
import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import {
    closeCheckInPlan,
    markCheckInConflict,
    openCheckInPlan,
    resetCheckInConflictStreak
} from '@nao-todo/shared/requester/checkin-window'
import { isJwtExpired } from '@nao-todo/shared/requester/session-end-reason'
import { onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import {
    AuthUseCase,
    isCredentialError,
    isRetryableCheckInConflict,
    USER_JWT_LOCALSTORAGE_KEY
} from '@nao-todo/domain-identity'

defineOptions({ name: 'AuthCheckIn' })
const props = defineProps<{ authUseCase: AuthUseCase; loadingText: string }>()
const emit = defineEmits<{ (e: 'checkInSuccess'): void }>()

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const failed = ref(false)
const errorMessage = ref('')

/**
 * 失败态主动作（`DEF-119` / T599 `F4`）
 * @description 主按钮必须与**真实概率**一致（R3）：
 *              - `signIn`：「重新登录」为主 —— 检入冲突（`10022`，**恒为主**，不随次数降级）
 *                与 token 已过期（重试无意义）；
 *              - `retry`：「重试」为主 —— 网络类 / 其他可重试失败。
 */
const primaryAction = ref<'retry' | 'signIn'>('retry')

/**
 * 待执行检入计划窗口（T558 R3）
 * @description 守卫通常已在「决定检入」时开窗（**早于**数据面请求派发）；本处再开一次是
 *              **幂等兜底**（组件被直接挂载/单测场景）。窗口生命周期 = 检入落定 或 本页卸载。
 */
openCheckInPlan()
onUnmounted(() => {
    closeCheckInPlan()
    // T599：冲突计数属本页生命周期 ⇒ 离开即复位
    resetCheckInConflictStreak()
})

/** 检入（可重试；失败态下点「重试」再次进入本函数） */
const checkIn = async (): Promise<void> => {
    loading.value = true
    failed.value = false
    errorMessage.value = ''
    const err = await props.authUseCase.checkIn(
        localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) || ''
    )
    // T558 R3：检入已落定 ⇒ 关闭计划窗口（非永久免死：此后到达的 10041 照旧处置）
    closeCheckInPlan()
    // B-3①：失败处理前先判路由 —— 用户已离开检入页（如「离线进入」）⇒ 静默 return，不弹错、不跳转
    if (route.name !== 'auth-checkin') return
    if (err === null) {
        // T599：检入成功 = 会话健康 ⇒ 冲突计数清零（新生命周期重新计）
        resetCheckInConflictStreak()
        emit('checkInSuccess')
        return
    }
    loading.value = false
    // T558 R1：检入冲突（`10022`）是「可重试」而非「会话失效」⇒ 显式可重试出口
    // （锦上添花：不清凭证、不回登录页；失败态自带「重试」+「重新登录」两个可前进动作）
    // DEF-119 / T599（`F4`）：同一冲突码只按**文案**分类，**主次按钮恒为「重新登录」**：
    //   - token 已过期 ⇒ 过期语义；
    //   - token 未过期 + 极短窗口（≤3s）内前后两次 `10022` ⇒ 并发文案（只换文案，不换主次）；
    //   - token 未过期（其余）⇒ 密码可能在他端被改 / 会话被撤销；
    //   - token 缺失或不可解析 ⇒ 不猜原因（T558 原文案）。
    //   理由：用例层已自动重试一次（token 已变即放弃）⇒ 走到页面的 `10022` 已吸收真并发；
    //   用户读文案后手动再试仍失败 ⇒ 反而**提高**「非并发」置信度，不得把主按钮降级成「重试」。
    if (isRetryableCheckInConflict(err)) {
        const streak = markCheckInConflict()
        const expired = isJwtExpired(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY))
        failed.value = true
        primaryAction.value = 'signIn'
        if (expired === true) {
            errorMessage.value = t('auth.checkIn.conflictExpired')
        } else if (expired === false && streak === 1) {
            errorMessage.value = t('auth.checkIn.conflictRevoked')
        } else if (expired === false) {
            errorMessage.value = t('auth.checkIn.conflictConcurrent')
        } else {
            errorMessage.value = t('auth.checkIn.conflict')
        }
        return
    }
    const message = unwrapError(err)
    if (isCredentialError(err)) {
        NueMessage.error(message)
        void router.replace('/auth/signin')
        return
    }
    // 网络类/其它：可重试失败态（不跳 signin）
    failed.value = true
    primaryAction.value = 'retry'
    errorMessage.value = message
}

/** 主动重新登录（失败终态的第二个可前进动作，C-02） */
const goSignIn = (): void => {
    void router.replace('/auth/signin')
}

void checkIn()
</script>

<template>
    <nue-container id="AuthCheckIn">
        <loading-component v-if="loading" :placeholder="loadingText" />
        <!-- 失败终态（C-01：显式穷尽；C-02：重试 + 重新登录） -->
        <nue-main v-else-if="failed">
            <nue-div vertical align="center" gap="0.75rem">
                <nue-text size="var(--nue-text-sm)">{{ errorMessage }}</nue-text>
                <!-- 主次按真实概率排列（DEF-119）；DOM 顺序 = 用户看到的主次 -->
                <template v-if="primaryAction === 'signIn'">
                    <nue-button theme="primary" @click="goSignIn">
                        {{ t('gate.signInAgain') }}
                    </nue-button>
                    <nue-button size="small" theme="pure" @click="checkIn">
                        {{ t('common.retry') }}
                    </nue-button>
                </template>
                <template v-else>
                    <nue-button theme="primary" @click="checkIn">
                        {{ t('common.retry') }}
                    </nue-button>
                    <nue-button size="small" theme="pure" @click="goSignIn">
                        {{ t('gate.signInAgain') }}
                    </nue-button>
                </template>
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#AuthCheckIn {
    align-items: center;
    justify-content: center;
    gap: 1.75rem;

    > .nue-header {
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }

    > .nue-main {
        width: 20rem;
        border: none;
        height: auto;
        align-items: center;
        justify-content: center;
        flex: none;
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }
}
</style>