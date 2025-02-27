<template>
    <nue-container class="fqfocus-view" theme="vertical,inner">
        <nue-main outline-width="45%">
            <template #content>
                <nue-container class="fqfocus-main" theme="vertical,inner">
                    <nue-header>
                        <template #logo>番茄时钟</template>
                    </nue-header>
                    <nue-main>
                        <nue-div vertical align="center" justify="center" flex>
                            <nue-text>专注</nue-text>
                            <nue-progress
                                :percentage="percentage"
                                type="circle"
                                hide-text
                                style="--circle-size: calc(100vw * 0.5)"
                            />
                        </nue-div>
                    </nue-main>
                </nue-container>
            </template>
            <template #outline>
                <nue-div vertical>
                    <nue-text theme="h3">概览</nue-text>
                </nue-div>
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const totalSeconds = 600
let seconds = 0
const percentage = ref(0)

setInterval(() => {
    seconds++
    if (seconds >= totalSeconds) seconds = 0
    percentage.value = (seconds / totalSeconds) * 100
}, 1000)
</script>

<style scoped></style>
