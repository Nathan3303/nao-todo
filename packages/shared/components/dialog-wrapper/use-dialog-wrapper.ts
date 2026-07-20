import { ref } from 'vue'
import type { DialogPayload, DialogRef } from './types'

const useDialogWrapper = (dialogRef: DialogRef) => {
    const visible = ref(false)
    const dialogPayload = ref<DialogPayload>({})

    const open = (payload?: DialogPayload) => {
        dialogPayload.value = payload || {}
        if (dialogRef.value) {
            dialogRef.value.open()
            return
        }
        visible.value = true
    }

    const close = () => {
        if (dialogRef.value) {
            dialogRef.value.close()
            return
        }
        visible.value = false
    }

    return { payload: dialogPayload, visible, open, close }
}

export default useDialogWrapper

