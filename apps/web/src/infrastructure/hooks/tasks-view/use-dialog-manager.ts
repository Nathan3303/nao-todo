export type DialogOpenFunc = (payload?: any, onClose?: () => void) => void

export type DialogCloseFunc = () => void

export type DialogFuncs = {
    open: DialogOpenFunc
    close: DialogCloseFunc
}

export type DialogManager = {
    registerDialog: (dialogName: string, dialogFuncs: DialogFuncs) => void
    openDialog: (dialogName: string, payload?: any, onClose?: () => void) => void
    closeDialog: (dialogName: string) => void
    unregisterDialog: (dialogName: string) => void
}

const useDialogManager = () => {
    // @state
    const dialogMapper: Map<string, DialogFuncs> = new Map()

    // @method 注册对话框
    const registerDialog = (dialogName: string, dialogFuncs: DialogFuncs) => {
        dialogMapper.set(dialogName, dialogFuncs)
    }

    // @method 打开对话框
    const openDialog = (dialogName: string, payload?: any, onClose?: () => void) => {
        const dialogFuncs = dialogMapper.get(dialogName)
        if (dialogFuncs) {
            dialogFuncs.open(payload, onClose)
        }
    }

    // @method 关闭对话框
    const closeDialog = (dialogName: string) => {
        const dialogFuncs = dialogMapper.get(dialogName)
        if (dialogFuncs) {
            dialogFuncs.close()
        }
    }

    // @method 注销对话框
    const unregisterDialog = (dialogName: string) => {
        dialogMapper.delete(dialogName)
    }

    // @returns
    return {
        registerDialog,
        openDialog,
        closeDialog,
        unregisterDialog
    }
}

export default useDialogManager
