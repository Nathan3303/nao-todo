import { Ref } from 'vue'
import { UpdatePasswordDialog, UserProfileDialog } from 'apps/web/src/layouts'

export const IndexViewCtxKey = 'INDEX_VIEW_CTX_KEY'

export type IndexViewCtx = {
    dialogsRef: {
        userProfile: Ref<InstanceType<typeof UserProfileDialog> | undefined>
        updatePassword: Ref<InstanceType<typeof UpdatePasswordDialog> | undefined>
    }
}
