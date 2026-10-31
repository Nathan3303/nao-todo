<script lang="ts" setup>
import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import {
    dismissSessionEndBanner,
    readVisibleSessionEndCategory,
    type SessionEndCategory
} from '@nao-todo/shared/requester/session-end-reason'
import { NueMessage } from 'nue-ui'
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { AuthUseCase, type SignInViewObject } from '@nao-todo/domain-identity'

defineOptions({ name: 'AuthSignIn' })
const props = defineProps<{ authUseCase: AuthUseCase }>()
const emit = defineEmits<{ (e: 'signInSuccess'): void }>()

const loading = ref(false)
const disabled = ref(false)
const route = useRoute()

/**
 * 注册链接的 `route`（DEF-95 / ADR D7）：携带 `redirect` 以保持深链不丢
 * @description 只接受**站内绝对路径**（防开放重定向），其余丢弃。
 */
const signUpLinkRoute = () => {
    const redirect = route.query.redirect
    const target =
        typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
            ? redirect
            : null
    return target ? { path: '/auth/signup', query: { redirect: target } } : { path: '/auth/signup' }
}
const signInVO = reactive<SignInViewObject>({ email: '', password: '' })

/**
 * 会话结束横幅（W3 / `DEF-92`，ADR D5）
 * @description 类别由单点 `session-end.ts` 在失效时按本地证据推断并落 `sessionStorage`；
 *              本组件**只读不判**（R2），web + desktop 共用本页 ⇒ 两端都有提示。
 *              横幅可关闭、不阻断表单（R4）；关闭后刷新不复发，但类别仍可读。
 */
const sessionEndCategory = ref<SessionEndCategory | null>(readVisibleSessionEndCategory())

const sessionEndMessage = computed(() => {
    switch (sessionEndCategory.value) {
        case 'expired':
            return t('auth.sessionEnd.expired')
        case 'signed-in-elsewhere':
            return t('auth.sessionEnd.signedInElsewhere')
        default:
            return t('auth.sessionEnd.ended')
    }
})

const closeSessionEndBanner = (): void => {
    dismissSessionEndBanner()
    sessionEndCategory.value = null
}

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
    emit('signInSuccess')
}
</script>

<template>
    <nue-container theme="sign-in">
        <!-- 会话结束横幅（W3）：行内提示，非模态、可关闭；位置在表单之上 -->
        <div
            v-if="sessionEndCategory"
            class="session-end-banner"
            data-testid="session-end-banner"
            role="status"
        >
            <span aria-hidden="true" class="session-end-banner__mark">!</span>
            <span class="session-end-banner__text">{{ sessionEndMessage }}</span>
            <button
                :aria-label="t('auth.sessionEnd.dismiss')"
                class="session-end-banner__close"
                type="button"
                @click="closeSessionEndBanner"
            >
                ×
            </button>
        </div>
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
                <router-link class="nue-link auth-link" :to="signUpLinkRoute()">{{
                    t('auth.signIn.registerLink')
                }}</router-link>
                {{ t('auth.signIn.goToRegister') }}
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
/* 会话结束横幅（W3 / DEF-92）：只用既有 nue-* 令牌（warning 阶）+ 圆角/间距令牌，不新造色值 */
.session-end-banner {
    display: flex;
    align-items: flex-start;
    box-sizing: border-box;
    gap: var(--nue-gap-xs);
    width: 100%;
    padding: var(--nue-padding-sm) var(--nue-padding-df);
    border: 1px solid var(--nue-warning-color-30);
    border-radius: var(--nue-radius-sm);
    background-color: var(--nue-warning-color-10);
    color: var(--nue-warning-color-90);
    font-size: var(--nue-text-sm);
    line-height: 1.5;
    text-align: left;
}

/* 符号冗余：不只靠颜色传达「需要注意」（DESIGN §2 三态可辨性） */
.session-end-banner__mark {
    flex: none;
    font-weight: 700;
}

.session-end-banner__text {
    flex: 1;
    min-width: 0;
}

.session-end-banner__close {
    flex: none;
    padding: 0 0.25rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: var(--nue-text-md);
    line-height: 1.2;
}

.session-end-banner__close:focus-visible {
    outline: 2px solid var(--nue-warning-color-80);
    outline-offset: 2px;
}

/* 互链：原生 router-link（DEF-116 规避）+ 既有 nue-link 主题色 */
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