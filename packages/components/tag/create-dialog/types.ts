type CreateOptions = {
    name: string
    color: string
}

type CreateTagDialogProps = CreateOptions & {
    handler: (options: CreateOptions) => Promise<any>
}

export type { CreateOptions, CreateTagDialogProps }
