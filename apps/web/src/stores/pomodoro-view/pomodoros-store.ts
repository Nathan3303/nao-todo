import { defineStore } from 'pinia'
import { usePomodorosStoreBase } from '../base'

export default defineStore('PomodorosStore', () => {
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
