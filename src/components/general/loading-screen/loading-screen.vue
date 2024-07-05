<template>
    <transition name="fade" mode="out-in" appear>
        <nue-div v-if="loading" class="loading-screen">
            <nue-div vertical width="fit-content" align="center">
                <nue-text size="26px">NaoTodo</nue-text>
                <nue-icon name="loading" spin size="32px"></nue-icon>
            </nue-div>
        </nue-div>
    </transition>
</template>

<script setup lang="ts">
defineOptions({ name: 'LoadingScreen' })
defineProps<{ loading: boolean }>()
</script>

<style scoped>
.loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: white;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.64s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
