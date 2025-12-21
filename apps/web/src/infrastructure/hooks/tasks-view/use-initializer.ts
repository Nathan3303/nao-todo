import type { UseInitializer } from '@/views/tasks/types'
import type { BuiltInProjectApp, ProjectApp } from '@nao-todo/application/project'
import type { TagApp } from '@nao-todo/application/tag'
import type { UserApp } from '@nao-todo/application/user'
import { useStateMachine } from '@nao-todo/hooks'
import { unwrapError } from '@nao-todo/utils'
import { ref } from 'vue'

const useInitializer: UseInitializer = (
    userApp: UserApp,
    projectApp: ProjectApp,
    builtInProjectApp: BuiltInProjectApp,
    tagApp: TagApp
) => {
    // @state 错误信息
    const error = ref<boolean>(false)
    const errorMessage = ref<string>('初始化失败')

    // @state 加载态
    const loading = ref<boolean>(false)
    const placeholder = ref<string>('')

    // @method 获取用户信息
    const getUserProfile = async () => {
        placeholder.value = '获取用户信息中...'
        const err = await userApp.getProfile()
        if (err) {
            error.value = true
            errorMessage.value = '用户信息获取失败：' + unwrapError(err)
            return false
        }
        return true
    }

    // @method 获取内建清单列表
    const getBuiltInProjects = () => {
        placeholder.value = '获取内建清单列表中...'
        const [, err] = builtInProjectApp.list()
        if (err !== null) {
            error.value = true
            errorMessage.value = '内建清单列表获取失败：' + unwrapError(err)
            return false
        }
        return true
    }

    // @method 获取用户清单列表
    const getProjects = async () => {
        placeholder.value = '获取清单列表中...'
        const [, err] = await projectApp.list()
        if (err !== null) {
            error.value = true
            errorMessage.value = '清单列表获取失败：' + unwrapError(err)
            return false
        }
        return true
    }

    // @method 获取用户标签列表
    const getTags = async () => {
        placeholder.value = '获取标签列表中...'
        const err = await tagApp.list()
        if (err) {
            error.value = true
            errorMessage.value = '标签列表获取失败：' + unwrapError(err)
            return false
        }
        return true
    }

    // @hook 状态机
    const stateMachine = useStateMachine([getUserProfile, getBuiltInProjects, getProjects, getTags])

    // @method 初始化
    const start = async () => {
        loading.value = true
        errorMessage.value = '初始化失败'
        const isDone = await stateMachine.start()
        loading.value = false
        error.value = !isDone
        return isDone
    }

    // @method 重试
    const retry = async () => {
        loading.value = true
        const isDone = await stateMachine.retry()
        loading.value = false
        error.value = !isDone
        return isDone
    }

    // @returns
    return { error, errorMessage, start, retry, loading, placeholder }
}

export default useInitializer
