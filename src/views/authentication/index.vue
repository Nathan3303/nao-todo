<template>
    <nue-container class="authentication-view">
        <nue-main aside-width="45%">
            <template #aside>
                <nue-div vertical justify="space-between" flex>
                    <nue-div align="center">
                        <nue-text size="32px" color="white">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text size="16px" color="white">
                        Lorem ipsum dolor sit amet consectetur adipisicing elit. Atque quod porro ex
                        fuga. Possimus sequi dolorem laborum? Eveniet, vero molestiae error ut quam
                        laborum, debitis cumque hic assumenda pariatur voluptatum!
                    </nue-text>
                </nue-div>
            </template>
            <template #content>
                <nue-div vertical height="100%" align="center" gap="0px">
                    <nue-div align="center" justify="end" height="0px">
                        <nue-button @click="$router.push(switchRoute)">
                            {{ switchButtonText }}
                        </nue-button>
                    </nue-div>
                    <component :is="subView"></component>
                </nue-div>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SignIn from './sign-in.vue'
import SignUp from './sign-up.vue'
import './index.css'

const props = defineProps<{ operation?: string }>()

const isLogin = computed(() => props.operation === 'login')
const switchButtonText = computed(() => (isLogin.value ? 'Sign Up' : 'Sign In'))
const subView = computed(() => (isLogin.value ? SignIn : SignUp))
const switchRoute = computed(() =>
    isLogin.value ? '/authentication/signup' : '/authentication/login'
)
</script>
