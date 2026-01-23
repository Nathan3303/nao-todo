import type { UserApp } from '@nao-todo/application/user'
import type { BuiltInProjectApp, ProjectApp } from '@nao-todo/application/project'
import type { TagApp } from '@nao-todo/application/tag'
import type { Ref } from 'vue'

export type UseInitializer = (
    userApp: UserApp,
    projectApp: ProjectApp,
    builtInProjectApp: BuiltInProjectApp,
    tagApp: TagApp
) => {
    error: Ref<boolean>
    errorMessage: Ref<string>
    loading: Ref<boolean>
    placeholder: Ref<string>
    start: () => Promise<boolean>
    retry: () => Promise<boolean>
}
