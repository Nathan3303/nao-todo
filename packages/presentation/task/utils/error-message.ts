import { t, unwrapError, type GoError, type LocaleKey } from '@nao-todo/shared'
import { TaskErrorCode, type TaskErrorCodeValue } from '@nao-todo/domain-task'

/**
 * 领域错误码 → i18n key 映射
 * @description 使用 Record 强制全覆盖，新增错误码若漏配会直接编译报错
 */
const CODE_TO_LOCALE_KEY: Record<TaskErrorCodeValue, LocaleKey> = {
    [TaskErrorCode.NAME_EMPTY]: 'task.error.nameEmpty',
    [TaskErrorCode.NAME_TOO_LONG]: 'task.error.nameTooLong',
    [TaskErrorCode.DESC_TOO_LONG]: 'task.error.descTooLong',
    [TaskErrorCode.STATE_INVALID]: 'task.error.stateInvalid',
    [TaskErrorCode.PRIORITY_INVALID]: 'task.error.priorityInvalid',
    [TaskErrorCode.REMIND_REPEAT_INVALID]: 'task.error.remindRepeatInvalid',
    [TaskErrorCode.REMIND_TIME_FORMAT_INVALID]: 'task.error.remindTimeFormatInvalid',
    [TaskErrorCode.REMIND_AT_INVALID]: 'task.error.remindAtInvalid',
    [TaskErrorCode.START_AT_INVALID]: 'task.error.startAtInvalid',
    [TaskErrorCode.END_AT_INVALID]: 'task.error.endAtInvalid',
    [TaskErrorCode.START_AFTER_END]: 'task.error.startAfterEnd',
    [TaskErrorCode.GIVEN_UP_AT_INVALID]: 'task.error.givenUpAtInvalid',
    [TaskErrorCode.GIVEN_UP_BEFORE_START]: 'task.error.givenUpBeforeStart',
    [TaskErrorCode.STAR_MARK_AT_INVALID]: 'task.error.starMarkAtInvalid',
    [TaskErrorCode.STAR_MARK_FORBIDDEN]: 'task.error.starMarkForbidden',
    [TaskErrorCode.SNOOZE_DURATION_NOT_INTEGER]: 'task.error.snoozeDurationNotInteger',
    [TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE]: 'task.error.snoozeDurationOutOfRange',
    [TaskErrorCode.TASK_ID_EMPTY]: 'task.error.taskIdEmpty',
    [TaskErrorCode.CHECK_ITEM_NAME_EMPTY]: 'task.error.checkItemNameEmpty',
    [TaskErrorCode.CHECK_ITEM_NAME_TOO_LONG]: 'task.error.checkItemNameTooLong',
    [TaskErrorCode.CHECK_ITEM_SORT_ID_NEGATIVE]: 'task.error.checkItemSortIdNegative',
    [TaskErrorCode.CHECK_ITEM_NOT_FOUND]: 'task.error.checkItemNotFound',
    [TaskErrorCode.COMMENT_CONTENT_EMPTY]: 'task.error.commentContentEmpty',
    [TaskErrorCode.COMMENT_CONTENT_TOO_LONG]: 'task.error.commentContentTooLong'
}

/**
 * 将任务领域错误翻译为用户可读文案
 * @description 领域层只产出错误码，翻译在表现层完成。
 *              非领域错误（如网络异常）按原样透出。
 * @param err 领域错误码或原始错误
 * @returns 用户可读文案
 */
export const translateTaskError = (err: GoError): string => {
    const errString = unwrapError(err)
    const localeKey = CODE_TO_LOCALE_KEY[errString as TaskErrorCodeValue]
    return localeKey ? t(localeKey) : errString
}