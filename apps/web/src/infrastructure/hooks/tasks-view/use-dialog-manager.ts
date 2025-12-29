export type DialogOpenFunc = (payload?: any) => void
export type DialogCloseFunc = () => void
export type DialogFuncs = {
    open: DialogOpenFunc
    close: DialogCloseFunc
}

const useDialogManager = () => {
    // @state
    const dialogMapper: Map<string, DialogFuncs> = new Map()

    // @method 注册对话框
    const registerDialog = (dialogName: string, dialogFuncs: DialogFuncs) => {
        dialogMapper.set(dialogName, dialogFuncs)
    }

    // @method 打开对话框
    const openDialog = (dialogName: string, payload?: any) => {
        const dialogFuncs = dialogMapper.get(dialogName)
        if (dialogFuncs) {
            dialogFuncs.open(payload)
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
