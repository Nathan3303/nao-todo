import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { type GoError } from '@nao-todo/shared/types'
import { TaskErrorCode, type TaskErrorCodeValue } from '@nao-todo/domain-task'
import { NueMessage } from 'nue-ui'
import { isArchivedReadOnlyError } from '../archive-gate'

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
    [TaskErrorCode.SCHEDULE_FORBIDDEN]: 'task.error.scheduleForbidden',
    [TaskErrorCode.TASK_NOT_FOUND]: 'task.error.taskNotFound',
    [TaskErrorCode.PARENT_SELF]: 'task.error.parentSelf',
    [TaskErrorCode.PARENT_NOT_FOUND]: 'task.error.parentNotFound',
    [TaskErrorCode.PARENT_MUST_BE_TOP_LEVEL]: 'task.error.parentMustBeTopLevel',
    [TaskErrorCode.PARENT_HAS_SUBTASKS]: 'task.error.parentHasSubtasks',
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

/**
 * 展示任务写操作失败提示
 * @description 与 TaskHandler 的错误提示同口径：领域错误翻译为文案，网络类错误原样透出。
 *              web 端仓储直连服务端，断网写失败会被归一化为业务错误（不 reject）
 *              ⇒ 调用方必须显式检查返回值并提示，否则构成「看似成功实则丢失」。
 * @param key 错误文案键
 * @param err 错误对象
 */
export const notifyTaskError = (key: LocaleKey, err: GoError): void => {
    // 归档只读码的提示由守卫负责（本地化）；此处跳过，避免重复 + 原始错误码外泄（T191）
    if (isArchivedReadOnlyError(err)) return
    NueMessage.error(t(key, { error: `(${translateTaskError(err)})` }))
}