import type { Project } from '@nao-todo/stores'
import type { Ref } from 'vue'

export type ProjectViewContext = {
    project: Ref<Project | null>
}
