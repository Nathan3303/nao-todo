<script setup lang="ts">
import {
    // PasswordRuleHint,
    RuleHint,
    t,
    unwrapError
} from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, reactive, ref } from 'vue'
import type { UserRestoreEmits, UserRestoreFormData, UserRestoreProps } from './types'
import dayjs from 'dayjs'

defineOptions({ name: 'UserRestore' })
const props = defineProps<UserRestoreProps>()
const emits = defineEmits<UserRestoreEmits>()

const loading = ref(false)
const formData = reactive<UserRestoreFormData>({ password: '', agreed: false })

const submitButtonDisabled = computed(() => {
    return formData.password.length < 8 || !formData.agreed
})

const submit = async () => {
    loading.value = true
    const err = await props.userUseCase.restore({
        password: formData.password,
        agreed: formData.agreed
    })
    loading.value = false
    if (err !== null) {
        NueMessage.error(t('user.restoreFailed') + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success(t('user.restoreSuccess'))
    emits('restored')
}
</script>

<template>
    <nue-container theme="restore-user">
        <nue-main>
            <nue-content>
                <nue-div vertical gap=".5rem" align="center" flex="1">
                    <nue-text tag="h2" size="xl" weight="bold">
                        {{ t('user.restoreWarningTitle') }}
                    </nue-text>
                </nue-div>
                <nue-div vertical gap=".75rem" style="width: 100%; max-width: 28rem">
                    <rule-hint :title="t('user.restoreWarningTitle')" icon="" variant="warning">
                        {{ t('user.restoreWarningContent') }}
                    </rule-hint>
                    <nue-div vertical gap=".5rem" theme="form-item">
                        <nue-text theme="label" size="sm">{{
                            t('user.deletionDeadline')
                        }}</nue-text>
                        <nue-text theme="value" size="base" :weight="500">
                            {{
                                dayjs(props.deletionDeadline).format('YYYY-MM-DD HH:mm:ss') ||
                                t('user.deletionDeadlineUnknown')
                            }}
                        </nue-text>
                    </nue-div>
                    <nue-divider />
                    <form autocomplete="off" name="RestoreUserForm" @submit.prevent="submit">
                        <nue-div vertical gap=".25rem" theme="form-item">
                            <nue-text theme="label">{{ t('user.password') }}</nue-text>
                            <!-- <password-rule-hint /> -->
                            <nue-input
                                v-model="formData.password"
                                allow-show-password
                                clearable
                                maxlength="24"
                                :placeholder="t('user.passwordPlaceholder')"
                                type="password"
                            />
                        </nue-div>
                        <nue-checkbox theme="pure" v-model="formData.agreed">
                            {{ t('user.restoreAgreement') }}
                        </nue-checkbox>
                        <nue-button
                            :disabled="submitButtonDisabled"
                            :loading="loading"
                            theme="primary"
                            type="submit"
                        >
                            {{ t('user.restoreSubmit') }}
                        </nue-button>
                        <nue-button @click="emits('confirm-unrestore')">
                            {{ t('user.cancelRestore') }}
                        </nue-button>
                    </form>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container--restore-user > .nue-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
}

.nue-container--restore-user .nue-content {
    width: 100%;
    max-width: 20rem;
    flex: none;

    .nue-checkbox--pure {
        padding: 0;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: var(--nue-gap-sm);
    }
}
</style>

