import type { Project } from "@/stores"

export type ProjectBoardProps = {
    projects?: Project[]
    loadingState?: boolean
    allowRoute?: boolean
}

export type ProjectBoardEmits = {}
