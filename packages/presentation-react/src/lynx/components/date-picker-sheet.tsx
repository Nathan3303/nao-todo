import { useEffect, useState } from '@lynx-js/react'
import { Button } from '@lynx-js/lynx-ui'
import { useI18n } from '../../hooks/use-i18n'
import {
    applyQuickOption,
    isoToValue,
    stepValue,
    valueToIso,
    valueToText,
    type DateField,
    type DatePickerValue,
    type DateQuickOption
} from '../../logic/date-picker-core'
import { BottomSheet } from './bottom-sheet'
import './date-picker-sheet.css'

export type DatePickerSheetProps = {
    /** 受控显示 */
    show: boolean
    /** date：仅日期；datetime：日期 + 时间 */
    mode: 'date' | 'datetime'
    /** 初始值（ISO）；空为当前时间 */
    initial: string | null
    /** 确认：null 表示清空 */
    onConfirm: (iso: string | null) => void
    /** 取消/遮罩关闭 */
    onCancel: () => void
}

/**
 * 日期选择弹层（自绘 BottomSheet，Lynx 无系统日期选择）
 * @description 快捷项（今天/明天/本周日/下周一/清空）+ 年/月/日/时/分步进微调；
 *              步进自动归一化（跨月/闰年）。确认后回调 ISO 字符串。
 */
export const DatePickerSheet = ({
    show,
    mode,
    initial,
    onConfirm,
    onCancel
}: DatePickerSheetProps) => {
    const { t } = useI18n()
    const [value, setValue] = useState<DatePickerValue>(() => isoToValue(initial))

    // 每次打开时按初始值重置
    useEffect(() => {
        if (show) setValue(isoToValue(initial))
    }, [show, initial])

    const fields: Array<{ key: DateField; label: string }> = [
        { key: 'year', label: String(value.year) },
        { key: 'month', label: String(value.month) },
        { key: 'day', label: String(value.day) },
        ...(mode === 'datetime'
            ? [
                  { key: 'hour' as DateField, label: String(value.hour) },
                  { key: 'minute' as DateField, label: String(value.minute) }
              ]
            : [])
    ]

    const quickOptions: Array<{ key: DateQuickOption; label: string }> = [
        { key: 'today', label: t('mobile.datePicker.today') },
        { key: 'tomorrow', label: t('mobile.datePicker.tomorrow') },
        { key: 'week-sunday', label: t('mobile.datePicker.weekSunday') },
        { key: 'week-monday', label: t('mobile.datePicker.weekMonday') },
        { key: 'clear', label: t('mobile.datePicker.clear') }
    ]

    return (
        <BottomSheet show={show} onClose={onCancel}>
            <view className="dps-panel">
                {/* 标题行 */}
                <view className="dps-head">
                    <Button className="dps-head-btn" onClick={onCancel}>
                        <text className="dps-head-btn-text dps-cancel">
                            {t('mobile.datePicker.cancel')}
                        </text>
                    </Button>
                    <text className="dps-head-title">
                        {valueToText(value, mode === 'datetime')}
                    </text>
                    <Button className="dps-head-btn" onClick={() => onConfirm(valueToIso(value))}>
                        <text className="dps-head-btn-text dps-ok">
                            {t('mobile.datePicker.confirm')}
                        </text>
                    </Button>
                </view>

                {/* 快捷项 */}
                <view className="ts-chips dps-quick">
                    {quickOptions.map((option) => (
                        <Button
                            key={option.key}
                            className="ts-chip"
                            onClick={() => {
                                const next = applyQuickOption(value, option.key)
                                if (next === null) {
                                    onConfirm(null)
                                } else {
                                    setValue(next)
                                }
                            }}
                        >
                            <text className="ts-chip-text">{option.label}</text>
                        </Button>
                    ))}
                </view>

                {/* 步进微调 */}
                <view className="dps-fields">
                    {fields.map((field) => (
                        <view className="dps-field" key={field.key}>
                            <text className="dps-field-label">{field.label}</text>
                            <view className="dps-field-row">
                                <Button
                                    className="dps-step"
                                    onClick={() => setValue((v) => stepValue(v, field.key, -1))}
                                >
                                    <text className="dps-step-text">−</text>
                                </Button>
                                <Button
                                    className="dps-step"
                                    onClick={() => setValue((v) => stepValue(v, field.key, 1))}
                                >
                                    <text className="dps-step-text">+</text>
                                </Button>
                            </view>
                        </view>
                    ))}
                </view>
            </view>
        </BottomSheet>
    )
}