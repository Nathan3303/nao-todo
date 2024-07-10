<template>
    <nue-div vertical align="center" justify="center" wrap="nowrap" flex>
        <nue-text size="12px" color="gray">
            * 这是已完成任务和过去15天每天的所有任务的条形图。
        </nue-text>
        <div id="todo-analysis"></div>
    </nue-div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    TransformComponent,
    LegendComponent
} from 'echarts/components'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTodoStore } from '@/stores'

echarts.use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    TransformComponent,
    BarChart,
    LabelLayout,
    UniversalTransition,
    CanvasRenderer,
    LegendComponent
])

const todoStore = useTodoStore()

const option = {
    tooltip: {},
    legend: { data: ['Done', 'Total'] },
    xAxis: { data: [] },
    yAxis: {},
    series: [
        {
            name: 'Done',
            type: 'bar',
            data: [],
            itemStyle: { color: '#696969', opacity: 0.8 }
        },
        {
            name: 'Total',
            type: 'bar',
            data: [],
            itemStyle: { color: '#212121', opacity: 0.8 }
        }
    ]
}

const fetchData = async () => {
    const response = await todoStore.getTodoStatesAnalysis()
    if (response.code === '20000') {
        const newData = sequalizeResponseData(response.data)
        console.log(newData)
        newData.forEach((data) => {
            option.xAxis.data.push(data.name)
            option.series[0].data.push(data.count.done)
            option.series[1].data.push(data.count.total)
        })
    }
}

const sequalizeResponseData = (data) => {
    return data.map((item) => {
        const count = { todo: 0, done: 0, total: 0 }
        item.states.map((state) => {
            if (state.state === 'done') {
                count.done += state.count
            } else {
                count.todo += state.count
            }
            count.total += state.count
        })
        return { name: item._id, count }
    })
}

onMounted(() => {
    const todoAnalysisChart = echarts.init(document.getElementById('todo-analysis'))
    todoAnalysisChart.showLoading()
    fetchData()
    setTimeout(() => {
        todoAnalysisChart.hideLoading()
        todoAnalysisChart.setOption(option)
        window.addEventListener('resize', () => {
            todoAnalysisChart.resize()
        })
    }, 1000)
})
</script>

<style scoped>
#todo-analysis {
    width: 100%;
    height: 100%;
}
</style>
