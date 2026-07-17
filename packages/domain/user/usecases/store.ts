import type {
    UpdateUserConfigViewObject,
    UpdateUserViewObject,
    UserConfigViewObject,
    UserViewObject
} from './viewobjects'

/**
 * 用户存储接口
 * @description 用户存储接口，包含用户相关操作
 */
export interface UserStore {
    /**
     * 设置用户信息
     * @param userProfile 用户信息
     */
    setUserProfile: (userProfile: UserViewObject) => void

    /**
     * 更新用户信息
     * @param updateUserViewObject 更新用户信息
     */
    updateUserProfile: (updateUserViewObject: UpdateUserViewObject) => void

    /**
     * 设置用户配置
     * @param userConfig 用户配置
     */
    setUserConfig: (userConfig: UserConfigViewObject) => void

    /**
     * 更新用户配置
     * @param updateUserConfigViewObject 更新用户配置
     */
    updateUserConfig: (updateUserConfigViewObject: UpdateUserConfigViewObject) => void
}

