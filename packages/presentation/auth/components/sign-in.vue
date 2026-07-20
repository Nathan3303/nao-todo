<script lang="ts" setup>
import { t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SignInViewObject } from '@nao-todo/application/auth/viewobjects'
import { AuthUseCase } from '@nao-todo/application/auth/usecases'

defineOptions({ name: 'AuthSignIn' })
const props = defineProps<{ authUseCase: AuthUseCase }>()

const router = useRouter()

const loading = ref(false)
const disabled = ref(false)
const signInVO = reactive<SignInViewObject>({ email: '', password: '' })

const submit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    const err = await props.authUseCase.signIn(signInVO)
    if (err !== null) {
        signInVO.password = ''
        loading.value = disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success(t('auth.signIn.success'))
    const lastRoute = localStorage.getItem('LAST_VISITED_ROUTE')
    await router.push(lastRoute || '/tasks')
}
</script>

<template>
    <nue-container theme="sign-in">
        <nue-header>
            <nue-div align="center" gap="0.5rem" vertical>
                <nue-text size="1.725rem" weight="bold">{{ t('auth.signIn.title') }}</nue-text>
                <nue-text color="gray" size="0.875rem">{{ t('auth.signIn.subtitle') }}</nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content @keydown.enter="submit">
                <form autocomplete="off" name="NaoTodoSignInForm">
                    <nue-div vertical>
                        <nue-input
                            v-model="signInVO.email"
                            :disabled="loading || disabled"
                            :placeholder="t('auth.signIn.emailPlaceholder')"
                            type="email"
                        />
                        <nue-input
                            v-model="signInVO.password"
                            :disabled="loading || disabled"
                            allow-show-password
                            :placeholder="t('auth.signIn.passwordPlaceholder')"
                            type="password"
                        />
                        <nue-button
                            :loading="loading"
                            :disabled="disabled"
                            theme="primary"
                            type="submit"
                            @click="submit"
                        >
                            {{ t('auth.signIn.submit') }}
                        </nue-button>
                    </nue-div>
                </form>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-text align="center">
                {{ t('auth.signIn.noAccount') }}
                <nue-link route="/auth/signup">{{ t('auth.signIn.registerLink') }}</nue-link>
                {{ t('auth.signIn.goToRegister') }}
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
.nue-container--sign-in {
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
