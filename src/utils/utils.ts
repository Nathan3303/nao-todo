export function findOne(arr: any[], how: (item: any, index: number) => boolean): any {
    let result = null
    for (let i = 0; i < arr.length; i++) {
        if (how(arr[i], i)) {
            result = arr[i]
            break
        }
    }
    return result
}
