import useCommentDomain from './service'
import { CommentEntity } from './entities'
import type { CommentRepository } from './repositories'

export type { CommentRepository }
export { useCommentDomain, CommentEntity }
