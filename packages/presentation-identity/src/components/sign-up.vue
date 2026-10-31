<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { PasswordRuleHint } from '@nao-todo/shared/components/rule-hint'
import { AuthUseCase, type SignUpViewObject } from '@nao-todo/domain-identity'

defineOptions({ name: 'AuthSignUp' })
const props = defineProps<{ authUseCase: AuthUseCase }>()

const router = useRouter()
const route = useRoute()

/**
 * 深链目标（DEF-95 / ADR D7）：只接受**站内绝对路径**，其余丢弃
 * @description 防开放重定向：`//host` / `http(s)://` / 非字符串一律不认。
 */
const deepLinkTarget = (): string | null => {
    const redirect = route.query.redirect
    if (typeof redirect !== 'string') return null
    if (!redirect.startsWith('/') || redirect.startsWith('//')) return null
    return redirect
}

/** 登录/注册互链的 `route`（携带 `redirect` 以保持深链不丢） */
const authLinkRoute = (path: '/auth/signin' | '/auth/signup') => {
    const target = deepLinkTarget()
    return target ? { path, query: { redirect: target } } : { path }
}

const loading = ref(false)
const disabled = ref(false)
const signUpVO = reactive<SignUpViewObject>({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: ''
})

const submit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    const err = await props.authUseCase.signUp(signUpVO)
    loading.value = false
    if (err !== null) {
        signUpVO.password = signUpVO.confirmPassword = ''
        disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success(t('auth.signUp.success'))
    // DEF-95：注册成功保留 `query.redirect`，回到分享链接的目标页
    await router.push(deepLinkTarget() ?? '/auth/signin')
}
</script>

<template>
    <nue-container theme="sign-up">
        <nue-header>
            <nue-div align="center" gap="0.5rem" vertical>
                <nue-text size="1.725rem" weight="bold">{{ t('auth.signUp.title') }}</nue-text>
                <nue-text align="center" color="grey" size="0.875rem" style="white-space: pre-line">
                    {{ t('auth.signUp.subtitle') }}
                </nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content @keydown.enter="submit">
                <form autocomplete="off" name="NaoTodoSignUpForm">
                    <nue-div vertical>
                        <nue-input
                            v-model="signUpVO.email"
                            :disabled="loading"
                            clearable
                            name="SignUpEmail"
                            :placeholder="t('auth.signUp.emailPlaceholder')"
                            type="email"
                            maxlength="64"
                            counter="word-left"
                        />
                        <nue-input
                            v-model="signUpVO.password"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            :placeholder="t('auth.signUp.passwordPlaceholder')"
                            type="password"
                            maxlength="24"
                            counter="word-left"
                        />
                        <password-rule-hint />
                        <nue-input
                            v-model="signUpVO.confirmPassword"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            :placeholder="t('auth.signUp.confirmPassword')"
                            type="password"
                            maxlength="24"
                            counter="word-left"
                        />
                        <nue-input
                            v-model="signUpVO.nickname"
                            :disabled="loading"
                            :placeholder="t('auth.signUp.nickname')"
                            maxlength="32"
                            counter="word-left"
                        />
                        <nue-button
                            :loading="loading"
                            theme="primary"
                            type="submit"
                            @click="submit"
                        >
                            {{ t('auth.signUp.submit') }}
                        </nue-button>
                    </nue-div>
                </form>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-text align="center">
                {{ t('auth.signUp.hasAccount') }}
                <router-link class="nue-link auth-link" :to="authLinkRoute('/auth/signin')">{{
                    t('auth.signUp.loginLink')
                }}</router-link>
                {{ t('auth.signUp.goToLogin') }}
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
/* 互链：原生 router-link（DEF-116 规避：nue-link 的 route 分支在本版本不出 href）+ 既有主题色 */
.auth-link {
    text-decoration: none;
}

.auth-link:hover {
    text-decoration: underline;
}

.auth-link:focus-visible {
    outline: 2px solid var(--nue-primary-color-600);
    outline-offset: 2px;
}

.nue-container--sign-up {
    align-items: center;
    justify-content: center;
    gap: var(--nue-gap-md);
    width: 20rem;
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
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        align-items: center;
        justify-content: center;
        height: auto;
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }
}
</style>