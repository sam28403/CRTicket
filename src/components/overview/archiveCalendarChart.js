import * as echarts from 'echarts'

export function createCharts(context) {
  const {
    mapChartRef, calendarChartRef, statisticsChartRef, cityChartRef,
    ticketHistory, monthlyData, selectedMonth, statisticsData,
    isDark, chartText, chartBackground, getCityName,
  } = context
function renderCalendarChart() {
  if (!calendarChartRef.value || !selectedMonth.value) return;

  const container = calendarChartRef.value;
  echarts.getInstanceByDom(container)?.dispose();
  const chart = echarts.init(container, isDark.value ? 'dark' : undefined);

  const [year, month] = selectedMonth.value.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 构建日期数据 map，方便快速查找
  const dataMap = new Map();
  monthlyData.value.forEach(item => {
    dataMap.set(item.travel_date, item.count);
  });

  // 补充完整一个月的所有日期（无数据的日期 count 为 0，但仍然显示）
  const calendarData = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarData.push([dateStr, dataMap.get(dateStr) || 0]);
  }

  const maxCount = monthlyData.value.length > 0
    ? Math.max(...monthlyData.value.map(t => t.count))
    : 3;

  const option = {
    tooltip: {
      renderMode: 'richText',
      formatter: (params) => {
        if (params.data[1] === 0) {
          return `${params.data[0]}\n无运转记录`;
        }
        return `${params.data[0]}\n运转次数: ${params.data[1]} 次`;
      }
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      show: false,
      inRange: {
        color: ['#ebedee', '#c3d6f2', '#86a8e7', '#5470c6', '#23448e']
      }
    },
    calendar: {
      orient: 'vertical',
      top: 50,
      left: 30,
      right: 20,
      cellSize: [Math.floor((container.offsetWidth - 50) / 7), 50],
      range: selectedMonth.value,
      itemStyle: {
        borderWidth: 0.5,
        borderColor: '#e0e0e0'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#f0f0f0',
          width: 1
        }
      },
      yearLabel: { show: false },
      monthLabel: {
        show: false,
        color: '#333',
        fontSize: 11,
        nameMap: 'ZH'
      },
      dayLabel: {
        firstDay: 1,
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
        fontSize: 10,
        color: chartText()
      }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      label: {
        show: true,
        formatter: (params) => {
          const count = params.data[1];
          const maxCount = monthlyData.value.length > 0
            ? Math.max(...monthlyData.value.map(t => t.count))
            : 3;
          const ratio = maxCount > 0 ? count / maxCount : 0;
          const style = ratio > 0.5 ? 'light' : 'dark';
          return `{${style}|${params.data[0].split('-')[2]}}`;
        },
        rich: {
          light: {
            fontSize: 14,
            color: '#ffffff'
          },
          dark: {
            fontSize: 14,
            color: '#333333'
          }
        }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        }
      },
      data: calendarData
    }]
  };

  option.backgroundColor = chartBackground();
  chart.setOption(option);
}


 return { renderCalendarChart }
}


