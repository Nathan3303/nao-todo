// 用户头裁剪弹窗属性
export type UserAvatarCropperDialogProps = {
    modelValue: boolean
    file: File | null
}

// 用户头裁剪弹窗事件
export type UserAvatarCropperDialogEmits = {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success', file: File): void
}

