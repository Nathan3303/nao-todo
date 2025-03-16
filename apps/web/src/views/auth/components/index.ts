import { defineAsyncComponent } from 'vue'

export const AuthSignIn = defineAsyncComponent({
    loader: () => import('./sign-in.vue'),
    delay: 0
})

export const AuthSignUp = defineAsyncComponent({
    loader: () => import('./sign-up.vue'),
    delay: 0
})

// import AuthSignIn from './sign-in.vue'
// import AuthSignUp from './sign-up.vue'

// export { AuthSignIn, AuthSignUp }
