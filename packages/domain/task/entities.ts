export class TaskEntity {
    public id: string = ''
    public projectId: string = ''
    public name: string = ''
    public description: string = ''
    public state: string = ''
    public priority: string = ''
    public startAt: string = ''
    public endAt: string = ''
    public tags: string[] = []
    public updatedAt: string = ''
    public createdAt: string = ''
    public isDeleted: boolean = false
    public archivedAt: string | null = null
    public isArchived: boolean = false
    public starMarkAt: string | null = null
    public isStarMarked: boolean = false
    public givenUpAt: string | null = null
    public isGivenUp: boolean = false
}