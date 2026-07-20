import { useMapperStoreBase } from '@nao-todo/shared'
import type { PomodoroViewObject } from '@nao-todo/application/pomodoro/viewobjects'

export const usePomodorosStoreBase = () => {
    const {
        list: pomodoros,
        setList: setPomodoros,
        addItem: addPomodoro,
        getItem: getPomodoro,
        patchItem: patchPomodoro
    } = useMapperStoreBase<PomodoroViewObject>()

    // @action 获取所有常用番茄专注
    const getAllPomodoros = () => {
        const allPomodoros: PomodoroViewObject[] = []
        pomodoros.value.forEach((pomodoro) => allPomodoros.push(pomodoro))
        return allPomodoros
    }

    // @returns
    return {
        pomodoros,
        setPomodoros,
        addPomodoro,
        getPomodoro,
        patchPomodoro,
        getAllPomodoros
    }
}

export type PomodorosStoreBase = ReturnType<typeof usePomodorosStoreBase>
