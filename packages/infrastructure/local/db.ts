import { Dexie, type EntityTable } from 'dexie'
import type { TaskModel } from './models'

const localDB = new Dexie('nao-todo') as Dexie & {
    tasks: EntityTable<TaskModel, 'id'>
}

localDB.version(1).stores({
    tasks: '++id, _id, _createdAt, userId'
})

export { localDB }
export type LocalDB = typeof localDB

