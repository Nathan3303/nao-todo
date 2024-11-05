<template>
    <transition name="fade" mode="out-in" appear>
        <nue-div v-if="loading || error" class="loading-screen">
            <nue-div vertical width="fit-content" align="center">
                <nue-text size="26px">NaoTodo</nue-text>
                <nue-icon name="loading" spin size="32px"></nue-icon>
                <template v-if="error">
                    <nue-text size="14px" color="red">{{ errorMessage?.message }}</nue-text>
                    <nue-button @click="emit('refresh')">Refresh</nue-button>
                </template>
            </nue-div>
        </nue-div>
    </transition>
</template>

<script setup lang="ts">
defineOptions({ name: 'LoadingScreen' })
defineProps<{ loading: boolean; error: boolean; errorMessage: null | Error }>()
const emit = defineEmits<{ (event: 'refresh'): void }>()
</script>

<style scoped>
@import url('./loading-screen.css');
</style>
