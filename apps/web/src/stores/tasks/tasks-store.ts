import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types/viewobjects/task'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { indexedDBTaskRepository } from '@nao-todo/infrastructure/indexeddb/repositories/task-repo'

export interface TaskWithSyncStatus extends TaskViewObject {
  _syncStatus: 'local' | 'syncing' | 'synced' | 'conflict'
  _localId?: string
  _lastSyncedAt?: string
}

const useTasksStore = defineStore('TasksStore', () => {
  // @state 任务列表
  const tasks = ref<TaskWithSyncStatus[]>([])

  // @computed 任务列表 Map
  const tasksMap = computed(() => {
    return new Map(tasks.value.map((task) => [task.id, task]))
  })

  // @state 同步状态
  const syncStatus = ref({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: undefined as string | undefined,
    syncError: undefined as string | undefined,
  })

  // @action 从 IndexedDB 初始化任务列表
  const initializeFromIndexedDB = async () => {
    try {
      const localTasks = await indexedDBTaskRepository.findAll()
      tasks.value = localTasks
    } catch (error) {
      console.error('Initialize tasks from IndexedDB error:', error)
    }
  }

  // @action 设置任务列表
  const setTasks = (newTasks: TaskViewObject[]) => {
    tasks.value = newTasks.map(task => ({
      ...task,
      _syncStatus: 'synced',
      _lastSyncedAt: new Date().toISOString(),
    }))
  }

  // @action 更新任务
  const updateTask = (taskId: TaskViewObject['id'], updateOptions: UpdateTaskViewObject) => {
    const idx = tasks.value.findIndex((task) => task.id === taskId)
    if (idx === -1) return
    tasks.value[idx] = {
      ...tasks.value[idx],
      ...updateOptions,
      _syncStatus: 'local',
      _lastSyncedAt: new Date().toISOString(),
    }
  }

  // @action 添加任务
  const addTask = (task: TaskViewObject) => {
    const index = tasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) return
    tasks.value.push({
      ...task,
      _syncStatus: 'synced',
      _lastSyncedAt: new Date().toISOString(),
    })
  }

  // @action 获取任务
  const getTask = (taskId: TaskViewObject['id']) => {
    return tasksMap.value.get(taskId)
  }

  // @action 删除任务
  const removeTask = (taskId: TaskViewObject['id']) => {
    const idx = tasks.value.findIndex((task) => task.id === taskId)
    if (idx !== -1) {
      tasks.value.splice(idx, 1)
    }
  }

  // @action 更新同步状态
  const updateSyncStatus = (status: typeof syncStatus.value) => {
    syncStatus.value = status
  }

  // @action 手动同步任务
  const syncTasks = async () => {
    // 这个方法会由 Task UseCase 调用
  }

  // @returns
  return {
    list: tasks,
    syncStatus,
    setTasks,
    updateTask,
    addTask,
    getTask,
    removeTask,
    initializeFromIndexedDB,
    updateSyncStatus,
    syncTasks,
  }
})

export default useTasksStore
