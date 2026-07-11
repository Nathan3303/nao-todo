import { defineStore } from 'pinia'
import { usePomodorosStoreBase } from '../base'

export default defineStore('PomodorosStore', () => {
    const { pomodoros, setPomodoros, addPomodoro, getPomodoro, getAllPomodoros } =
        usePomodorosStoreBase()

    // @returns
    return {
        pomodoros,
        setPomodoros,
        addPomodoro,
        getPomodoro,
        getAllPomodoros
    }
})
