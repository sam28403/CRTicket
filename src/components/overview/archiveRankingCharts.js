import * as echarts from 'echarts'

export function createCharts(context) {
  const {
    mapChartRef, calendarChartRef, statisticsChartRef, cityChartRef,
    ticketHistory, monthlyData, selectedMonth, statisticsData,
    isDark, chartText, chartBackground, getCityName,
  } = context
function renderStationChart() {
  if (!statisticsChartRef.value) return;

  echarts.getInstanceByDom(statisticsChartRef.value)?.dispose();
  const chart = echarts.init(statisticsChartRef.value, isDark.value ? 'dark' : undefined);

  // 合并出发和到达站点统计（数据已经是站点全名）
  const stationCountMap = new Map();

  statisticsData.value.departures.forEach(item => {
    const name = item.station;  // 直接使用站点全名
    stationCountMap.set(name, {
      name,
      departure: item.count,
      arrival: 0
    });
  });

  statisticsData.value.arrivals.forEach(item => {
    const name = item.station;
    if (stationCountMap.has(name)) {
      stationCountMap.get(name).arrival = item.count;
    } else {
      stationCountMap.set(name, {
        name,
        departure: 0,
        arrival: item.count
      });
    }
  });

  const sortedStations = [...stationCountMap.values()]
    .sort((a, b) => (b.departure + b.arrival) - (a.departure + a.arrival))
    .slice(0, 10);

  const option = {
    title: {
      text: '最常到达站点统计',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'normal', color: chartText() }
    },
    tooltip: {
      renderMode: 'richText',
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['出发次数', '到达次数'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: sortedStations.map(s => s.name),
      axisLabel: { rotate: 30, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '次数'
    },
    series: [
      {
        name: '出发次数',
        type: 'bar',
        data: sortedStations.map(s => s.departure),
        itemStyle: { color: '#5470c6' }
      },
      {
        name: '到达次数',
        type: 'bar',
        data: sortedStations.map(s => s.arrival),
        itemStyle: { color: '#91cc75' }
      }
    ]
  };

  option.backgroundColor = chartBackground();
  chart.setOption(option);
}

function renderCityChart() {
  if (!cityChartRef.value) return;

  echarts.getInstanceByDom(cityChartRef.value)?.dispose();
  const chart = echarts.init(cityChartRef.value, isDark.value ? 'dark' : undefined);

  // 统计城市访问次数（出发+到达），数据已是站点全名
  const cityCountMap = new Map();

  statisticsData.value.departures.forEach(item => {
    const city = getCityName(item.station);  // 通过站点全名获取城市名
    if (city) {
      cityCountMap.set(city, (cityCountMap.get(city) || 0) + item.count);
    }
  });

  statisticsData.value.arrivals.forEach(item => {
    const city = getCityName(item.station);
    if (city) {
      cityCountMap.set(city, (cityCountMap.get(city) || 0) + item.count);
    }
  });

  const sortedCities = [...cityCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const option = {
    title: {
      text: '最常访问城市统计',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'normal', color: chartText() }
    },
    tooltip: {
      renderMode: 'richText',
      trigger: 'item',
      formatter: '{b}: {c} 次'
    },
    series: [
      {
        name: '访问次数',
        type: 'pie',
        radius: '55%',
        data: sortedCities.map(([name, value]) => ({ name, value })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          formatter: '{b}: {c}'
        }
      }
    ]
  };

  option.backgroundColor = chartBackground();
  chart.setOption(option);
}


 return { renderStationChart, renderCityChart }
}


