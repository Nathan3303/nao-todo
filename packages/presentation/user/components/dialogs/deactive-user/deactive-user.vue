<script setup lang="ts">
import {
    type DialogInstanceType,
    RuleHint,
    t,
    unwrapError,
    useDialogWrapper,
    USER_DEACTIVE_DIALOG_KEY
} from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import type { UserDeactiveEmits, UserDeactiveFormData, UserDeactiveProps } from './types'

defineOptions({ name: 'UserDeactiveDialog' })
const props = defineProps<UserDeactiveProps>()
const emits = defineEmits<UserDeactiveEmits>()

const dialogRef = ref<DialogInstanceType>()
const { visible, close } = useDialogWrapper(dialogRef)
const loading = ref(false)
const formData = reactive<UserDeactiveFormData>({
    password: '',
    confirmPassword: '',
    agreed: false
})

const submitButtonDisabled = computed(() => {
    return (
        formData.password.length < 8 ||
        formData.confirmPassword.length < 8 ||
        formData.password !== formData.confirmPassword ||
        !formData.agreed
    )
})

const open = () => (visible.value = true)

const submit = async () => {
    loading.value = true
    const err = await props.userUseCase.deactive({
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        agreed: formData.agreed
    })
    loading.value = false
    if (err !== null) {
        NueMessage.error(t('user.deactiveFailed') + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success(t('user.deactiveSuccess'))
    emits('deactivated')
}

onMounted(() => {
    props.dialogManager.register(USER_DEACTIVE_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" :title="t('user.deactiveDialogTitle')">
        <nue-container theme="deactive-user">
            <nue-main>
                <nue-content>
                    <nue-div vertical>
                        <form
                            action=""
                            autocomplete="off"
                            method="post"
                            name="DeactiveUserForm"
                            @submit.prevent="submit"
                        >
                            <nue-div align="stretch" vertical>
                                <nue-div theme="form-item">
                                    <nue-text theme="label">{{ t('user.password') }}</nue-text>
                                    <nue-input
                                        v-model="formData.password"
                                        allow-show-password
                                        clearable
                                        maxlength="24"
                                        :placeholder="t('user.passwordPlaceholder')"
                                        type="password"
                                    />
                                    <nue-input
                                        v-model="formData.confirmPassword"
                                        allow-show-password
                                        clearable
                                        maxlength="24"
                                        :placeholder="t('user.confirmPasswordPlaceholder')"
                                        type="password"
                                    />
                                </nue-div>
                                <nue-div theme="form-item">
                                    <rule-hint
                                        :title="t('user.deactiveWarningTitle')"
                                        icon=""
                                        variant="warning"
                                    >
                                        {{ t('user.deactiveWarningContent') }}
                                    </rule-hint>
                                    <nue-checkbox theme="pure" v-model="formData.agreed">
                                        {{ t('user.deactiveAgreement') }}
                                    </nue-checkbox>
                                </nue-div>
                                <nue-div style="margin-top: 0.5rem">
                                    <nue-button
                                        :disabled="submitButtonDisabled"
                                        :loading="loading"
                                        theme="danger"
                                        type="submit"
                                    >
                                        {{ t('user.deactiveSubmit') }}
                                    </nue-button>
                                </nue-div>
                            </nue-div>
                        </form>
                    </nue-div>
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
.nue-container--deactive-user {
    max-width: 24rem;
}

.nue-checkbox--pure {
    padding: 0;
}
</style>

