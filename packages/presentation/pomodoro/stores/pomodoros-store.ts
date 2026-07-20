import { defineStore } from 'pinia'
import { usePomodorosStoreBase } from '../hooks'

export const usePomodorosStore = defineStore('PomodorosStore', () => {
    const { pomodoros, setPomodoros, addPomodoro, getPomodoro, patchPomodoro, getAllPomodoros } =
        usePomodorosStoreBase()

    // @returns
    return {
        pomodoros,
        setPomodoros,
        addPomodoro,
        getPomodoro,
        patchPomodoro,
        getAllPomodoros
    }
})
