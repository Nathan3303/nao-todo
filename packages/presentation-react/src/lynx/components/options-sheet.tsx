import { Button } from '@lynx-js/lynx-ui'
import { BottomSheet } from './bottom-sheet'
import './options-sheet.css'

/** 选项分组（单选 chips） */
export type OptionsSheetSection = {
    title: string
    options: Array<{ key: string; label: string }>
    selectedKey: string
    onSelect: (key: string) => void
}

/** 操作项（点击立即执行并关闭） */
export type OptionsSheetAction = {
    key: string
    label: string
    /** 当前选中态（如隐藏已完成开关） */
    checked?: boolean
    danger?: boolean
    onPress: () => void
}

export type OptionsSheetProps = {
    show: boolean
    title: string
    /** 分组单选区（排序/筛选） */
    sections?: OptionsSheetSection[]
    /** 操作列表（更多） */
    actions?: OptionsSheetAction[]
    /** 确认按钮文案（有 sections 时显示） */
    confirmText?: string
    onConfirm?: () => void
    onCancel: () => void
}

/**
 * 通用选项弹层（排序/筛选/更多）
 * @description 自绘 BottomSheet：分组单选 chips（黄铜填充选中）+ 底部确认，或操作列表（点击即执行）。
 */
export const OptionsSheet = ({
    show,
    title,
    sections = [],
    actions = [],
    confirmText,
    onConfirm,
    onCancel
}: OptionsSheetProps) => {
    return (
        <BottomSheet show={show} onClose={onCancel}>
            <view className="ops-panel">
                <view className="ops-head">
                    <text className="ops-head-title">{title}</text>
                    <Button className="ops-close" onClick={onCancel}>
                        <text className="ops-close-text">✕</text>
                    </Button>
                </view>

                {sections.map((section) => (
                    <view className="ops-section" key={section.title}>
                        <text className="ops-section-title">{section.title}</text>
                        <view className="ts-chips">
                            {section.options.map((option) => (
                                <Button
                                    key={option.key}
                                    className={`ts-chip${section.selectedKey === option.key ? ' ui-active' : ''}`}
                                    onClick={() => section.onSelect(option.key)}
                                >
                                    <text className="ts-chip-text">{option.label}</text>
                                </Button>
                            ))}
                        </view>
                    </view>
                ))}

                {sections.length > 0 && confirmText ? (
                    <Button className="ts-primary-btn ops-confirm" onClick={() => onConfirm?.()}>
                        <text className="ts-primary-btn-text">{confirmText}</text>
                    </Button>
                ) : null}

                {actions.map((action) => (
                    <Button
                        key={action.key}
                        className={`ops-action${action.checked ? ' checked' : ''}${action.danger ? ' danger' : ''}`}
                        onClick={action.onPress}
                    >
                        <text className="ops-action-text">{action.label}</text>
                    </Button>
                ))}
            </view>
        </BottomSheet>
    )
}

export default OptionsSheet