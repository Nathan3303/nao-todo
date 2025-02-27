import { markRaw, nextTick, ref, shallowReactive } from 'vue'
import { AsyncNaoProjectManager } from '@/layouts/project-manager'
import { AsyncNaoTagManager } from '@/layouts/tag-manager'
import { AsyncNaoOverdueTodoManager } from '@/layouts/overdue-todo-manager'
import NaoDialogManagerError from './error.vue'
import type {
    DialogId,
    DialogComponentInfo,
    DialogInfo,
    DialogPayload
} from '@/layouts/dialog-manager/types'

const asyncComponentMap = new Map<DialogId, DialogComponentInfo>()

asyncComponentMap.set('ProjectManager', ['清单管理', AsyncNaoProjectManager])
asyncComponentMap.set('TagManager', ['标签管理', AsyncNaoTagManager])
asyncComponentMap.set('OverdueTodoManager', ['过期任务管理', AsyncNaoOverdueTodoManager])

const useDialogManager = () => {
    const visible = ref(false)
    const loading = ref(false)
    const dialogInfo = shallowReactive<DialogInfo>({
        title: '对话框标题',
        component: NaoDialogManagerError,
        payload: {}
    })

    const getComponentInfoById = (id: DialogId): DialogComponentInfo => {
        const result = asyncComponentMap.get(id)
        if (!result) {
            console.warn(
                `[dialog-manager/use-async-dialog] Error: Cannot find async component from id ${id}`
            )
            return ['错误', NaoDialogManagerError]
        }
        return result
    }

    const setComponentInfoById = (id: DialogId, componentInfo: DialogComponentInfo) => {
        asyncComponentMap.set(id, componentInfo)
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
        loading,
        dialogInfo,
        getComponentInfoById,
        setComponentInfoById,
        show
    }
}

export default useDialogManager
