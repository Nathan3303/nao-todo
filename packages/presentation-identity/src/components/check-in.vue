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
import { type GoError, Loading as LoadingComponent, t, unwrapError } from '@nao-todo/shared'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { AuthUseCase, USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'

defineOptions({ name: 'AuthCheckIn' })
const props = defineProps<{ authUseCase: AuthUseCase; loadingText: string }>()
const emit = defineEmits<{ (e: 'checkInSuccess'): void }>()

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const failed = ref(false)
const errorMessage = ref('')

/** 凭证类失败（B-3②）：跳登录页重新登录 */
const isCredentialError = (err: GoError): boolean =>
    /登录已过期|凭证|401|403|10041/.test(unwrapError(err))

/** 检入（可重试；失败态下点「重试」再次进入本函数） */
const checkIn = async (): Promise<void> => {
    loading.value = true
    failed.value = false
    errorMessage.value = ''
    const err = await props.authUseCase.checkIn(
        localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) || ''
    )
    // B-3①：失败处理前先判路由 —— 用户已离开检入页（如「离线进入」）⇒ 静默 return，不弹错、不跳转
    if (route.name !== 'auth-checkin') return
    if (err === null) {
        emit('checkInSuccess')
        return
    }
    loading.value = false
    const message = unwrapError(err)
    if (isCredentialError(err)) {
        NueMessage.error(message)
        void router.replace('/auth/signin')
        return
    }
    // 网络类/其它：可重试失败态（不跳 signin）
    failed.value = true
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
                <nue-button theme="primary" @click="checkIn">{{ t('common.retry') }}</nue-button>
                <nue-button size="small" theme="pure" @click="goSignIn">
                    {{ t('gate.signInAgain') }}
                </nue-button>
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