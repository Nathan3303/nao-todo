import { defineStore } from 'pinia'
import { useProjectDomain } from '@nao-todo/domain/project'
import { useProjectRepository } from '@nao-todo/infrastructure/backend/project/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

export default defineStore('ProjectAppStore', () => {
    // @domain Project Domain
    const projectDomain = useProjectDomain(useProjectRepository(getRequesterImpl()))

    return {}
})
