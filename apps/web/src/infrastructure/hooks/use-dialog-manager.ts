/**
 * 对话框打开函数
 * @param payload 对话框打开时的参数
 * @param onClose 对话框关闭时的回调函数
 */
export type DialogOpener = (payload?: any, onClose?: () => void) => void

/**
 * 对话框关闭函数
 * @param afterClose 对话框关闭后的回调函数
 */
export type DialogCloser = (afterClose?: () => void) => void

/**
 * 对话框生命周期函数接口
 * @param open 对话框打开函数
 * @param close 对话框关闭函数
 * @param context 对话框上下文，用于存储对话框打开时的参数
 */
export type DialogLifecycle = {
    open: DialogOpener
    close: DialogCloser
    context?: Record<string, any>
}

/**
 * 对话框管理器
 */
class DialogManager {
    /**
     * 对话框映射表
     */
    private dialogMapper: Map<string, DialogLifecycle> = new Map()

    /**
     * 构造函数
     * @param allowDuplicateRegistration 是否允许重复注册对话框，默认允许
     */
    constructor(private allowDuplicateRegistration: boolean = true) {}

    /**
     * 注册对话框生命周期函数接口
     * @param dialogName 对话框名称
     * @param dialogLifecycle 对话框生命周期函数接口
     */
    register(dialogName: string, dialogLifecycle: DialogLifecycle) {
        // 检查对话框是否已注册
        const isExist = this.dialogMapper.has(dialogName)
        // 如果对话框已注册且不允许重复注册，则跳过注册
        if (isExist && !this.allowDuplicateRegistration) {
            console.warn(
                `Dialog ${dialogName} already registered, skip registration. ` +
                    'Please check if you want to allow duplicate registration.'
            )
            return
        }
        // 注册对话框生命周期函数接口
        this.dialogMapper.set(dialogName, dialogLifecycle)
    }

    /**
     * 打开对话框
     * @param dialogName 对话框名称
     * @param payload 对话框打开时的参数
     * @param onClose 对话框关闭时的回调函数
     */
    open(dialogName: string, payload?: any, onClose?: () => void) {
        // 检查对话框是否已注册
        const isExist = this.dialogMapper.has(dialogName)
        if (!isExist) {
            console.warn(`Dialog ${dialogName} not registered, skip opening.`)
            return
        }
        // 获取对话框生命周期函数接口
        const dialogLifecycle = this.dialogMapper.get(dialogName)
        if (!dialogLifecycle) return
        // 调用对话框打开函数
        dialogLifecycle.open(payload, onClose)
    }

    /**
     * 关闭对话框
     * @param dialogName 对话框名称
     */
    close(dialogName: string) {
        // 检查对话框是否已注册
        const isExist = this.dialogMapper.has(dialogName)
        if (!isExist) {
            console.warn(`Dialog ${dialogName} not registered, skip closing.`)
            return
        }
        // 获取对话框生命周期函数接口
        const dialogLifecycle = this.dialogMapper.get(dialogName)
        if (!dialogLifecycle) return
        // 调用对话框关闭函数
        dialogLifecycle.close()
    }

    /**
     * 注销对话框
     * @param dialogName 对话框名称
     */
    unregister(dialogName: string) {
        // 检查对话框是否已注册
        const isExist = this.dialogMapper.has(dialogName)
        if (!isExist) {
            console.warn(`Dialog ${dialogName} not registered, skip unregistering.`)
            return
        }
        // 注销对话框
        this.dialogMapper.delete(dialogName)
    }
}

/**
 * 创建对话框管理器实例
 * @param allowDuplicateRegistration 是否允许重复注册对话框
 * @returns 对话框管理器实例
 */
const useDialogManager = (allowDuplicateRegistration: boolean = false) => {
    return new DialogManager(allowDuplicateRegistration)
}

/**
 * 导出对话框管理器实例
 */
export default DialogManager
export { useDialogManager, type DialogManager }

