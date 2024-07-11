<template>
    <nue-div vertical align="center" justify="center" wrap="nowrap" flex style="height: 100%">
        <div id="state-analysis"></div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTodoStore } from '@/stores'
import * as echarts from 'echarts'

const todoStore = useTodoStore()

const { countInfo } = storeToRefs(todoStore)

const parseKey = (key: string) => {
    switch (key) {
        case 'todo':
            return '待办'
        case 'in-progress':
            return '正在进行'
        case 'done':
            return '已完成'
        default:
            return key
    }
}

const data = computed(() => {
    let arr = []
    type k = keyof typeof countInfo.value.byState
    for (const key in countInfo.value.byState) {
        const item = { value: countInfo.value.byState[key as k], name: parseKey(key) }
        arr.push(item)
    }
    return arr
})

const option = {
    tooltip: {},
    legend: {
        orient: 'vertical',
        x: 'left',
        data: ['待办', '正在进行', '已完成']
    },
    series: [
        {
            type: 'pie',
            radius: ['45%', '75%'],
            avoidLabelOverlap: false,
            label: {
                show: false,
                position: 'center'
            },
            labelLine: {
                show: true
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: '24',
                    fontWeight: 'bold'
                }
            },
            data: data.value
        }
    ]
}

onMounted(() => {
    const dom = document.getElementById('state-analysis')
    // console.log(dom)
    const StateAnalysisChart = echarts.init(dom)
    StateAnalysisChart.showLoading()
    setTimeout(() => {
        StateAnalysisChart.hideLoading()
        StateAnalysisChart.setOption(option)
        window.addEventListener('resize', () => {
            StateAnalysisChart.resize()
        })
    }, 1000)
})
</script>

<style scoped>
#state-analysis {
    width: 100%;
    height: 100px;
}
</style>
