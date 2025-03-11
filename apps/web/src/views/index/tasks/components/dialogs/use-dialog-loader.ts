import { markRaw, nextTick, reactive, ref } from 'vue'
import NaoDialogManagerError from './error.vue'
import type { DialogComponentInfo, DialogId, DialogInfo, DialogPayload } from './types'

const dialogComponents = new Map<DialogId, DialogComponentInfo>()

export const useDialogLoader = () => {
    const visible = ref(false)
    const dialogInfo = reactive<DialogInfo>({
        title: '对话框标题',
        component: NaoDialogManagerError,
        payload: {}
    })

    const setComponentInfoById = (id: DialogId, componentInfo: DialogComponentInfo) => {
        dialogComponents.set(id, componentInfo)
    }

    const getComponentInfoById = (id: DialogId): DialogComponentInfo => {
        const result = dialogComponents.get(id)
        if (!result) return ['错误', NaoDialogManagerError]
        return result
    }

    const updateDialogInfo = (dialogId: DialogId, dialogPayload: DialogPayload) => {
        const [dialogTitle, dialogComponent] = getComponentInfoById(dialogId)
        dialogInfo.title = dialogTitle
        dialogInfo.component = markRaw(dialogComponent)
        dialogInfo.payload = dialogPayload
    }

    const show = async (dialogId: DialogId, dialogPayload?: DialogPayload) => {
        updateDialogInfo(dialogId, dialogPayload || {})
        visible.value = true
        await nextTick(() => {
            dialogInfo.payload?.onDialogOpened?.()
        })
    }

    return {
        visible,
        dialogInfo,
        getComponentInfoById,
        setComponentInfoById,
        show
    }
}
