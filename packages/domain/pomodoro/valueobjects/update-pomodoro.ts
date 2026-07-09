import type { Go } from '@nao-todo/types'

//
export class UpdatePomodoroValueObject {
    public type?: number //
    public name?: string //
    public description?: string //
    public duration?: number //

    //
    constructor(public readonly id: string) {}

    //
    validate(): Go<void> {
        return null
    }
}


