export class AuthSessionValueObject {
    constructor(
        public jwt: string,
        public pendingDeletion: boolean,
        public deletionDeadline?: string
    ) {}
}