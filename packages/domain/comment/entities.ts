export class CommentEntity {
    public id: string = ''
    public taskId: string = ''
    public content: string = ''
    public createdAt: string = ''
    public attachments: string[] = []
    public isTopUp: boolean = false
    public commentUser: { avatar: string; nickname: string } = {
        avatar: '',
        nickname: ''
    }
}
