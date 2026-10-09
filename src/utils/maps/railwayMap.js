export function createRailwayGeo(viewport = {}) {
  return {
    map: 'china',
    roam: true,
    // 线路适配或缩小后仍允许从整个画布拖动、缩放，不限于当前地理包围盒。
    roamTrigger: 'global',
    // ECharts 会为 china 地图自动补画南海诸岛插图，需要单独隐藏。
    regions: [
      {
        name: '南海诸岛',
        silent: true,
        itemStyle: { opacity: 0 },
        label: { show: false },
        emphasis: {
          disabled: true,
          itemStyle: { opacity: 0 },
          label: { show: false }
        },
        select: {
          itemStyle: { opacity: 0 },
          label: { show: false }
        },
        blur: {
          itemStyle: { opacity: 0 },
          label: { show: false }
        }
      }
    ],
    label: { show: false },
    itemStyle: {
      areaColor: '#e8f5e9',
      borderColor: '#81c784',
      borderWidth: 1
    },
    emphasis: {
      itemStyle: { areaColor: '#c8e6c9' },
      label: { show: true, color: '#333' }
    },
    select: { disabled: true },
    ...viewport
  }
}
