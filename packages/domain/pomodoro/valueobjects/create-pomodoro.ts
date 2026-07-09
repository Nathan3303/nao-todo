import type { Go } from '@nao-todo/types'

//
export class CreatePomodoroValueObject {
    //
    constructor(
        public type: number,
        public name: string,
        public description: string,
        public duration: number
    ) {}

    //
    validate(): Go<void> {
        return null
    }
}





