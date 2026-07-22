import { computed, reactive, ref } from 'vue'
import { UserRestoreEmits, UserRestoreFormData, UserRestoreProps } from './types'
import { DialogCloser, t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'

/**
 *
 * @param props
 * @param emit
 * @returns
 */
export const useRestoreUserDialog = (
    props: UserRestoreProps,
    emit: UserRestoreEmits,
    close: DialogCloser
) => {
    // @state 加载状态
    const loading = ref(false)

    // @state 表单数据
    const formData = reactive<UserRestoreFormData>({ password: '', agreed: false })

    // @computed 表单验证
    const submitButtonDisabled = computed(() => {
        return formData.password.length < 8 || !formData.agreed
    })

    /**
     * 提交函数
     */
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
        emit('restored')
        close()
    }

    // @returns
    return {
        loading,
        formData,
        submitButtonDisabled,
        submit
    }
}


