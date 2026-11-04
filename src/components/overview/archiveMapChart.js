import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import stationCoordinates, { historicalStationCoordinates, loadChinaMap } from '@/utils/maps/stationCoordinates.js'
import { normalizeStationName } from '@/utils/stationName.js'
import { createRailwayGeo } from '@/utils/maps/railwayMap.js'

export function createCharts(context) {
  const {
    mapChartRef, calendarChartRef, statisticsChartRef, cityChartRef,
    ticketHistory, monthlyData, selectedMonth, statisticsData,
    isDark, chartText, chartBackground, getCityName,
  } = context
// 通过站点全名获取坐标（直接映射）
const getStationCoords = (stationName) => {
  const normalizedName = normalizeStationName(stationName);
  return stationCoordinates[stationName] || stationCoordinates[normalizedName]
    || historicalStationCoordinates[stationName] || historicalStationCoordinates[normalizedName] || null;
};

function renderMapChart() {
  if (!mapChartRef.value || ticketHistory.value.length === 0) return;

  echarts.getInstanceByDom(mapChartRef.value)?.dispose();
  const chart = echarts.init(mapChartRef.value, isDark.value ? 'dark' : undefined);
  const mobile = window.innerWidth <= 600;
  const hiddenStationNames = new Set(['南海诸岛']);

  // 收集所有有坐标的车站（用 Map 正确计数）
  const stationMap = new Map(); // key: "经度,纬度", value: { name, value, count }
  const lines = [];

  ticketHistory.value.forEach(ticket => {
    const departureCoords = getStationCoords(ticket.departureStation);
    const arrivalCoords = getStationCoords(ticket.arrivalStation);

    if (departureCoords && !hiddenStationNames.has(ticket.departureStation)) {
      const key = `${departureCoords[0]},${departureCoords[1]}`;
      if (stationMap.has(key)) {
        stationMap.get(key).count += 1;
      } else {
        stationMap.set(key, {
          name: ticket.departureStation,
          value: departureCoords,
          count: 1
        });
      }
    }

    if (arrivalCoords) {
      const key = `${arrivalCoords[0]},${arrivalCoords[1]}`;
      if (stationMap.has(key)) {
        stationMap.get(key).count += 1;
      } else {
        stationMap.set(key, {
          name: ticket.arrivalStation,
          value: arrivalCoords,
          count: 1
        });
      }
    }

    // 如果出发和到达都有坐标，添加轨迹线
    if (
      departureCoords &&
      arrivalCoords &&
      !hiddenStationNames.has(ticket.departureStation) &&
      !hiddenStationNames.has(ticket.arrivalStation)
    ) {
      lines.push({
        coords: [departureCoords, arrivalCoords]
      });
    }
  });

  const uniquePoints = [...stationMap.values()];

  const maxCount = Math.max(...uniquePoints.map(p => p.count), 1);

  // 先加载地图数据
  loadChinaMap(echarts).then(mapLoaded => {
    if (chart.isDisposed()) return;
    if (!mapLoaded) {
      ElMessage.warning('地图数据加载失败，请刷新页面重试');
      return;
    }

    const option = {
      title: {
        text: '全部铁路运转轨迹',
        left: 'center',
        textStyle: {
          fontSize: mobile ? 16 : 24,
          fontWeight: 'bold',
          color: chartText(),
          textBorderColor: isDark.value ? '#000' : '#fff',
          textBorderWidth: 3
        }
      },
      tooltip: {
      renderMode: 'richText',
        trigger: 'item',
        formatter: (params) => {
          if (params.componentType === 'series' && params.seriesType === 'effectScatter') {
            return `${params.data.name}\n运转次数: ${params.data.count} 次`;
          }
          return '';
        }
      },
      geo: createRailwayGeo({
        itemStyle: { areaColor: isDark.value ? '#20342b' : '#e8f5e9', borderColor: isDark.value ? '#568361' : '#81c784' },
        ...(mobile ? {
          boundingCoords: [[110, 43], [124, 21]],
          left: 0,
          right: 0,
          top: 36,
          bottom: 0,
          zoom: 1,
          roam: false,
        } : { zoom: 1.2, center: [105, 36] }),
      }),
      series: [
        {
          name: '运转轨迹',
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 2,
          symbol: ['none', 'none'],
          effect: {
            show: true,
            period: 4,
            trailLength: 0.4,
            color: '#ff9800',
            symbol: 'circle',
            symbolSize: 4
          },
          lineStyle: {
            color: '#ff9800',
            width: 2,
            opacity: 0.6,
            curveness: 0.2
          },
          data: lines
        },
        {
          name: '站点',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          zlevel: 3,
          rippleEffect: {
            brushType: 'stroke',
            scale: 3
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{b}',
            fontSize: 10,
            color: chartText(),
            textBorderColor: chartBackground(),
            textBorderWidth: 3
          },
          symbolSize: (val, params) => {
            const count = params.data.count;
            return Math.max(8, Math.min(20, 8 + count * 2));
          },
          itemStyle: {
            color: '#e53935'
          },
          data: uniquePoints.map(p => ({
            name: p.name,
            value: p.value,
            count: p.count
          }))
        }
      ]
    };

    option.backgroundColor = chartBackground();
  chart.setOption(option);
  });
}


 return { renderMapChart }
}

