<template>
    <nue-container theme="sign-up">
        <nue-header>
            <nue-div align="center" gap="0.5rem" vertical>
                <nue-text size="1.725rem" weight="bold">{{ t('auth.signUp.title') }}</nue-text>
                <nue-text align="center" color="grey" size="0.875rem">
                    {{ t('auth.signUp.subtitle') }}
                </nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content @keydown.enter="handleSubmit">
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
                            @click="handleSubmit"
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
                <nue-link route="/auth/signin">{{ t('auth.signUp.loginLink') }}</nue-link>
                {{ t('auth.signUp.goToLogin') }}
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { inject, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PasswordRuleHint } from '@nao-todo/components'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { t } from '@nao-todo/infrastructure/locales'
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import type { SignUpViewObject } from '@nao-todo/usecases/auth'

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const loading = ref(false)
const disabled = ref(false)
const signUpVO = reactive<SignUpViewObject>({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: ''
})

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    const err = await authUseCase.signUp(signUpVO)
    loading.value = false
    if (err !== null) {
        signUpVO.password = signUpVO.confirmPassword = ''
        disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success(t('auth.signUp.success'))
    await router.push({ path: '/auth/signin' })
}
</script>

<style scoped>
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
