// 用户头像查看弹窗属性
export type UserAvatarViewerDialogProps = {
    modelValue: boolean
    avatarUrl: string
}

// 用户头像查看弹窗事件
export type UserAvatarViewerDialogEmits = {
    (e: 'update:modelValue', value: boolean): void
}

