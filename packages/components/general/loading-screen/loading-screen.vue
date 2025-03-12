<template>
    <transition name="fade" mode="out-in" appear>
        <nue-div v-if="loading || error" class="loading-screen">
            <nue-div vertical width="fit-content" align="center">
                <svg
                    t="1741753056341"
                    class="icon"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="4041"
                    width="64"
                    height="64"
                >
                    <path
                        d="M95.34672892 26.08981324h833.27649576c35.3946458 0 64.08894694 28.69430114 64.08894695 64.08894694v833.27649576a64.08894694 64.08894694 0 0 1-64.08894695 64.08894695H95.34672892A64.08894694 64.08894694 0 0 1 31.25778198 923.45525595V90.17876018C31.25778198 54.78411438 59.95208312 26.08981324 95.34672892 26.08981324z"
                        fill="#212121"
                        p-id="4042"
                    ></path>
                    <path
                        d="M792.34163281 263.87548438c49.42645313 31.62796875 65.05439062 97.67460937 35.50394531 148.80649218l-0.89922656 1.55039063-188.65153125 314.63627344a99.03895313 99.03895313 0 0 1-34.4806875 34.32564843c-46.29466406 27.31788281-105.36454688 11.53490625-132.74444531-35.13185156l-151.81425-268.68269531c-9.51939844-16.71321094-30.35664844-22.29461719-46.57373437-12.6511875s-21.79849219 30.75975-12.74421094 47.44195312l0.34108594 0.58914844 162.32589843 283.16334375-85.70559375 0.15503906-140.86849218-245.14776562c-29.86052344-52.46521875-12.96126562-119.566125 37.64348437-150.85300782l1.55039063-0.93023437c51.65901563-30.79075781 117.98472656-12.96126562 148.12432031 39.84503906l0.15503906 0.27907031 0.06201563 0.12403125 151.00804687 267.25633594a23.19384375 23.19384375 0 0 0 39.90705469 1.20930469l0.43410937-0.68217188 188.65153125-314.63627343a34.232625 34.232625 0 0 0-10.6666875-46.32567188 30.97680469 30.97680469 0 0 0-43.22489062 10.1705625l-0.12403125 0.21705469-67.03889063 113.17851562-99.19399218 168.77552344-41.51946094-76.77534375 15.31785937-26.07757031a36.58921875 36.58921875 0 0 1 2.17054688-4.43411719l0.34108593-0.62015625 126.23280469-213.14770312 0.83721094-1.39535157c30.97680469-50.54273438 96.18623437-65.86059375 145.64369531-34.232625z"
                        fill="#eca50f"
                        p-id="4043"
                    ></path>
                </svg>
                <nue-text size="1.5rem">NaoTodo</nue-text>
                <nue-div align="center" justify="center" gap=".5rem">
                    <nue-icon name="loading" spin size="1rem" />
                    <nue-text size=".75rem">加载中 ...</nue-text>
                </nue-div>
                <template v-if="error">
                    <nue-text size="14px" color="red">
                        {{ errorMessage?.message }}
                    </nue-text>
                    <nue-button @click="emit('refresh')">Refresh</nue-button>
                </template>
            </nue-div>
        </nue-div>
    </transition>
</template>

<script setup lang="ts">
defineOptions({ name: 'LoadingScreen' })
defineProps<{
    loading: boolean
    error: boolean
    errorMessage: null | Error
}>()
const emit = defineEmits<{
    (event: 'refresh'): void
}>()
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

