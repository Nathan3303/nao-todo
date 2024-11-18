type CreateOptions = {
    name: string
    color: string
    description: string
}

type CreateTagDialogProps = {
    handler: (options: CreateOptions) => Promise<boolean>
}

export type { CreateOptions, CreateTagDialogProps }
