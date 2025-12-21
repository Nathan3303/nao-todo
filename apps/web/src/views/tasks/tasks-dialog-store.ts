import { shallowReactive } from 'vue'
import { defineStore } from 'pinia'

export type DialogOpenFunction = ((...args: any[]) => unknown) | null
export type DialogCloseFunction = (() => unknown) | null

type DialogFunctions = {
    open: DialogOpenFunction
    close: DialogCloseFunction
}

export default defineStore('TasksDialogStore', () => {
    // @state 清单创建对话框
    const projectCreator = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理清单创建对话框注册函数
    const handleProjectCreatorRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        projectCreator.open = open
        projectCreator.close = close
    }

    // @state 清单管理对话框
    const projectManager = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理清单管理对话框注册函数
    const handleProjectManagerRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        projectManager.open = open
        projectManager.close = close
    }

    // @state 标签创建对话框
    const tagCreator = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理标签创建对话框注册函数
    const handleTagCreatorRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        tagCreator.open = open
        tagCreator.close = close
    }

    // @state 标签管理对话框
    const tagManager = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理标签管理对话框注册函数
    const handleTagManagerRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        tagManager.open = open
        tagManager.close = close
    }

    // @state 标签颜色更新对话框
    const tagColorUpdater = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理标签颜色更新对话框注册函数
    const handleTagColorUpdaterRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        tagColorUpdater.open = open
        tagColorUpdater.close = close
    }

    // @state 任务创建对话框
    const todoCreator = shallowReactive<DialogFunctions>({ open: null, close: null })

    // @method 处理任务创建对话框注册函数
    const handleTodoCreatorRegister = (
        open: DialogFunctions['open'],
        close: DialogFunctions['close']
    ) => {
        todoCreator.open = open
        todoCreator.close = close
    }

    return {
        projectCreator,
        handleProjectCreatorRegister,
        projectManager,
        handleProjectManagerRegister,
        tagCreator,
        handleTagCreatorRegister,
        tagManager,
        handleTagManagerRegister,
        tagColorUpdater,
        handleTagColorUpdaterRegister,
        todoCreator,
        handleTodoCreatorRegister
    }
})
