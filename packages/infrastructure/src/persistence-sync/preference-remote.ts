/**
 * 偏好面远端读取（project / tag 按行 GET）
 * @description 偏好面**按行读取远端**的最小共用面：供
 *              ① 本地缺失恢复（repo 读路径）② 触发点对账（`preference-sync` 后台）复用。
 *              仅依赖 requester / persistence-go 转换器，**不依赖 `preference-sync`**（避免环）。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.4
 */
import type { Requester } from '@nao-todo/shared/requester'
import type { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import type { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { projectPreferenceRes2Entity } from '../persistence-go/project/converters'
import { tagPreferenceRes2Entity } from '../persistence-go/tag/converters'
import type { ProjectPreferenceRes, TagPreferenceRes, ResponseData } from '../persistence-go/models'
import { getJWTFromLocalStorage } from '../persistence-go/utils'

/** 服务端普通清单偏好获取成功码（T130 契约） */
export const PROJECT_PREFERENCE_GET_CODE = 20080
/** 服务端标签偏好获取成功码（DP-5 契约） */
export const TAG_PREFERENCE_GET_CODE = 30050

/** 鉴权头（无 localStorage 环境/异常 ⇒ 空头，由请求器归一化） */
const authHeaders = (): Record<string, string> => {
    try {
        return { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
    } catch {
        return {}
    }
}

/** 拉取服务端普通清单偏好（网络不可达 / 无数据 / 非成功码 ⇒ null） */
export const fetchRemoteProjectPreference = async (
    requester: Requester,
    projectId: string
): Promise<ProjectPreferenceEntity | null> => {
    try {
        const response = await requester.get(`/projects/${projectId}/preference`, {
            headers: authHeaders()
        })
        const res = response.data as ResponseData
        if (res?.code !== PROJECT_PREFERENCE_GET_CODE) return null
        return projectPreferenceRes2Entity(res.data as ProjectPreferenceRes)
    } catch {
        return null
    }
}

/** 拉取服务端标签偏好（网络不可达 / 无数据 / 非成功码 ⇒ null） */
export const fetchRemoteTagPreference = async (
    requester: Requester,
    tagId: string
): Promise<TagPreferenceEntity | null> => {
    try {
        const response = await requester.get(`/tags/${tagId}/preference`, {
            headers: authHeaders()
        })
        const res = response.data as ResponseData
        if (res?.code !== TAG_PREFERENCE_GET_CODE) return null
        return tagPreferenceRes2Entity(res.data as TagPreferenceRes)
    } catch {
        return null
    }
}