<template>
  <div class="user-page">
    <el-container class="user-layout">
      <el-header class="top-header">
        <el-avatar src="Picture1.png" />
        <h2>Sam-Lab CR Ticket Maker</h2>
      </el-header>
      <el-container>
        <el-aside width="220px" class="user-sidebar">
          <el-space direction="vertical" fill style="width: 100%">
            <el-button size="large" @click="goHome()">车票生成</el-button>
            <el-button size="large" @click="goHistory()">车票历史</el-button>
            <el-button size="large" type="primary">账户管理</el-button>
          </el-space>
        </el-aside>
        <el-main class="user-main">
          <section class="user-title-wrap">
            <div class="title-content">
              <div>
                <h1>账户设置</h1>
                <p>修改头像、用户名、密码，删除账户</p>
              </div>
              <el-button type="danger" @click="openDeleteDialog">
                <el-icon><Delete /></el-icon>
                删除账户
              </el-button>
            </div>
          </section>

          <div class="user-content-grid">
            <el-card class="avatar-card" shadow="hover">
              <template #header>
                <span>头像</span>
              </template>
              <div class="avatar-area">
                <el-avatar shape="square" :size="180" src="Picture1.png" />
                <el-button size="large" type="primary" disabled>更改头像（暂未开放）</el-button>
              </div>
            </el-card>

            <el-card class="profile-card" shadow="hover">
              <template #header>
                <span>个人信息</span>
              </template>
              <el-form label-position="top" class="profile-form" @submit.prevent>
                <el-form-item label="修改用户名（可选）">
                  <el-input v-model="newUsername" placeholder="输入新的用户名" size="large" clearable />
                </el-form-item>
                <el-form-item label="修改密码（可选）">
                  <el-input v-model="newPassword" type="password" show-password placeholder="输入新的密码" size="large" clearable />
                </el-form-item>
                <el-form-item label="重复密码">
                  <el-input v-model="repeatPassword" type="password" show-password placeholder="重复新的密码" size="large" clearable />
                </el-form-item>
                <el-form-item label="验证码">
                  <div class="captcha-group">
                    <el-input-otp v-model="captchaInput" :length="5" size="large"/>
                    <img ref="captchaImage" alt="点击刷新验证码" @click="refreshCaptcha" />
                  </div>
                </el-form-item>
                <el-button size="large" type="success" :loading="saving" @click="saveProfile">保存更改</el-button>
              </el-form>
            </el-card>
          </div>

          <el-dialog v-model="deleteDialogVisible" title="删除账户" width="450px" :close-on-click-modal="false">
            <el-alert
              title="删除账户后，所有数据将被永久清除且无法恢复"
              type="error"
              :closable="false"
              show-icon
              style="margin-bottom: 20px;"
            />
            <el-form label-position="top" @submit.prevent>
              <el-form-item label="密码验证">
                <el-input
                  v-model="deletePassword"
                  type="password"
                  show-password
                  placeholder="请输入当前密码"
                  size="large"
                  clearable
                />
              </el-form-item>
              <el-form-item label="验证码">
                <div class="captcha-group">
                  <el-input-otp v-model="deleteCaptchaInput" :length="5" size="large"/>
                  <img ref="deleteCaptchaImage" alt="点击刷新验证码" @click="refreshDeleteCaptcha" />
                </div>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="deleteDialogVisible = false">取消</el-button>
              <el-button type="danger" :loading="deleting" @click="handleDeleteAccount">确认删除</el-button>
            </template>
          </el-dialog>

          <el-card class="statistics-card" shadow="never">
            <h3>个人运转数据</h3>
            <template v-if="hasTicketData">
              <el-row :gutter="20" v-loading="statisticsLoading">
                <el-col :span="24">
                  <div ref="statisticsChartRef" class="chart-container"></div>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :xs="24" :sm="24" :md="12">
                  <div ref="cityChartRef" class="chart-container"></div>
                </el-col>
                <el-col :xs="24" :sm="24" :md="12">
                  <div class="calendar-wrapper">
                    <div class="calendar-header">
                      <span>月度运转日历</span>
                      <el-date-picker
                        v-model="selectedMonth"
                        type="month"
                        placeholder="选择月份"
                        format="YYYY-MM"
                        value-format="YYYY-MM"
                        :clearable="false"
                        size="small"
                        @change="loadMonthlyData"
                      />
                    </div>
                    <div ref="calendarChartRef" class="calendar-container"></div>
                  </div>
                </el-col>
              </el-row>

              <!-- 运转轨迹地图 -->
              <div class="map-section">
                <h4>历史运转轨迹</h4>
                <el-row :gutter="20">
                  <el-col :span="24">
                    <div ref="mapChartRef" class="map-container" v-loading="mapLoading"></div>
                  </el-col>
                </el-row>
                <el-empty v-if="!mapLoading && ticketHistory.length === 0" description="暂无轨迹数据"></el-empty>
              </div>
            </template>
            <el-empty v-else-if="!statisticsLoading && !mapLoading" description="暂无运转数据"></el-empty>
          </el-card>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { onMounted, ref, nextTick, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import api from "@/api.js";
import { drawCaptcha, generateCaptcha } from "@/utils/captcha.js";
import stationNamesData from "@/station_name.js";
import stationCoordinates, { loadChinaMap } from "@/utils/stationCoordinates.js";

const router = useRouter()
const goHome = () => {
  router.push('/')
}
const goHistory = () => {
  router.push('/history')
}

// 解析站点数据
const parseStations = () => {
  return stationNamesData
    .split('@')
    .filter(Boolean)
    .map((item) => {
      const arr = item.split('|')
      return {
        code: arr[0],
        name: arr[1],
        telecode: arr[2],
        en: arr[3],
        abbr: arr[4],
        city: arr[7],
      }
    })
}

const stations = parseStations()

// 构建站点名称到城市名的映射
const stationNameToCityMap = new Map();
stations.forEach(s => {
  if (s.name && s.city) {
    stationNameToCityMap.set(s.name, s.city);
  }
});

// 统计图表相关
const statisticsChartRef = ref(null)
const cityChartRef = ref(null)
const calendarChartRef = ref(null)
const mapChartRef = ref(null)
const statisticsLoading = ref(false)
const mapLoading = ref(false)
const statisticsData = ref({ departures: [], arrivals: [] })
const ticketHistory = ref([])
const selectedMonth = ref('')
const monthlyData = ref([])

const hasTicketData = computed(() => {
  return (
    statisticsData.value.departures.length > 0 ||
    statisticsData.value.arrivals.length > 0 ||
    ticketHistory.value.length > 0
  );
})

const getStationName = (code) => {
  const station = stations.find(s => s.code === code)
  return station ? station.name : code
}

const getCityName = (stationName) => {
  return stationNameToCityMap.get(stationName) || ''
}

async function loadStatistics() {
  const userRaw = localStorage.getItem("user");
  if (!userRaw) return;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return;
  }

  try {
    statisticsLoading.value = true;
    const response = await api.get(`/user/statistics?userId=${user.id}`);
    if (response.data.success) {
      statisticsData.value = response.data.data;
      await nextTick();
      renderStationChart();
      renderCityChart();
    }
  } catch (err) {
    console.error(err);
  } finally {
    statisticsLoading.value = false;
  }
}

async function loadMonthlyData() {
  if (!selectedMonth.value) return;

  const userRaw = localStorage.getItem("user");
  if (!userRaw) return;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return;
  }

  const [year, month] = selectedMonth.value.split('-');

  try {
    const response = await api.get(`/user/monthly-tickets?userId=${user.id}&year=${year}&month=${month}`);
    if (response.data.success) {
      monthlyData.value = response.data.data.tickets.map(t => ({
        ...t,
        travel_date: t.travel_date.replace(/(\d{4})年(\d{2})月(\d{2})日/, '$1-$2-$3')
      }));
      await nextTick();
      renderCalendarChart();
    }
  } catch (err) {
    console.error(err);
  }
}

function toCalendarDateKey(year, month, day) {
  return `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`;
}

async function loadTicketHistory() {
  const userRaw = localStorage.getItem("user");
  if (!userRaw) return;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return;
  }

  try {
    mapLoading.value = true;
    const response = await api.get(`/user/ticket-history?userId=${user.id}`);
    if (response.data.success) {
      ticketHistory.value = response.data.data;
      await nextTick();
      renderMapChart();
    }
  } catch (err) {
    console.error(err);
  } finally {
    mapLoading.value = false;
  }
}

// 通过站点全名获取坐标（直接映射）
const getStationCoords = (stationName) => {
  return stationCoordinates[stationName] || null;
};

function renderMapChart() {
  if (!mapChartRef.value || ticketHistory.value.length === 0) return;

  const chart = echarts.init(mapChartRef.value);

  // 收集所有有坐标的车站（用 Map 正确计数）
  const stationMap = new Map(); // key: "经度,纬度", value: { name, value, count }
  const lines = [];

  ticketHistory.value.forEach(ticket => {
    const departureCoords = getStationCoords(ticket.departureStation);
    const arrivalCoords = getStationCoords(ticket.arrivalStation);

    if (departureCoords) {
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
    if (departureCoords && arrivalCoords) {
      lines.push({
        coords: [departureCoords, arrivalCoords]
      });
    }
  });

  const uniquePoints = [...stationMap.values()];

  const maxCount = Math.max(...uniquePoints.map(p => p.count), 1);

  // 先加载地图数据
  loadChinaMap(echarts).then(mapLoaded => {
    if (!mapLoaded) {
      ElMessage.warning('地图数据加载失败，请刷新页面重试');
      return;
    }

    const option = {
      title: {
        text: '中老铁路运转轨迹',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'normal', color: '#17324d' }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.componentType === 'series' && params.seriesType === 'effectScatter') {
            return `${params.data.name}<br/>运转次数: ${params.data.count} 次`;
          }
          return '';
        }
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [105, 36],
        label: {
          show: false
        },
        itemStyle: {
          areaColor: '#e8f5e9',
          borderColor: '#81c784',
          borderWidth: 1
        },
        emphasis: {
          itemStyle: {
            areaColor: '#c8e6c9'
          },
          label: {
            show: true,
            color: '#333'
          }
        },
        select: {
          disabled: true
        }
      },
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
            color: '#17324d'
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

    chart.setOption(option);
  });
}

function renderCalendarChart() {
  if (!calendarChartRef.value || !selectedMonth.value) return;

  const container = calendarChartRef.value;
  const chart = echarts.init(container);

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
      formatter: (params) => {
        if (params.data[1] === 0) {
          return `${params.data[0]}<br/>无运转记录`;
        }
        return `${params.data[0]}<br/>运转次数: ${params.data[1]} 次`;
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
        color: '#666'
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

  chart.setOption(option);
}

function renderStationChart() {
  if (!statisticsChartRef.value) return;

  const chart = echarts.init(statisticsChartRef.value);

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
      textStyle: { fontSize: 16, fontWeight: 'normal', color: '#17324d' }
    },
    tooltip: {
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

  chart.setOption(option);
}

function renderCityChart() {
  if (!cityChartRef.value) return;

  const chart = echarts.init(cityChartRef.value);

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
      textStyle: { fontSize: 16, fontWeight: 'normal', color: '#17324d' }
    },
    tooltip: {
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

  chart.setOption(option);
}

const newUsername = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const captchaInput = ref('')
const captchaImage = ref(null)
const saving = ref(false)
let currentCaptcha = ""

const deletePassword = ref('')
const deleteCaptchaInput = ref('')
const deleteCaptchaImage = ref(null)
const deleteDialogVisible = ref(false)
const deleting = ref(false)
let deleteCurrentCaptcha = ""

function openDeleteDialog() {
  deletePassword.value = ''
  deleteCaptchaInput.value = ''
  deleteDialogVisible.value = true
  nextTick(() => {
    refreshDeleteCaptcha()
  })
}

function refreshCaptcha() {
  currentCaptcha = generateCaptcha();
  if (captchaImage.value) {
    captchaImage.value.src = drawCaptcha(currentCaptcha);
  }
}

function refreshDeleteCaptcha() {
  deleteCurrentCaptcha = generateCaptcha();
  if (deleteCaptchaImage.value) {
    deleteCaptchaImage.value.src = drawCaptcha(deleteCurrentCaptcha);
  }
}

async function saveProfile() {
  const inputCode = captchaInput.value.trim().toUpperCase();
  if (inputCode !== currentCaptcha) {
    ElMessage.error("验证码错误，请重新输入！");
    refreshCaptcha();
    return;
  }

  const username = newUsername.value.trim();
  const password = newPassword.value.trim();
  const repeat = repeatPassword.value.trim();

  if (!username && !password) {
    ElMessage.warning("请至少填写一个修改项");
    return;
  }

  if (password && password !== repeat) {
    ElMessage.error("两次输入的新密码不一致");
    return;
  }

  const userRaw = localStorage.getItem("user");
  if (!userRaw) {
    ElMessage.error("登录状态失效，请重新登录");
    router.push("/login");
    return;
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch (e) {
    ElMessage.error("用户信息读取失败，请重新登录");
    router.push("/login");
    return;
  }

  try {
    saving.value = true;
    const response = await api.post("/user/update-profile", {
      id: user.id,
      username: username || undefined,
      password: password || undefined
    });

    if (response.data.success) {
      if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      ElMessage.success("个人信息修改成功");
      newUsername.value = "";
      newPassword.value = "";
      repeatPassword.value = "";
      captchaInput.value = "";
      refreshCaptcha();
      return;
    }

    ElMessage.error(response.data.message || "修改失败，请稍后重试");
  } catch (err) {
    console.error(err);
    ElMessage.error("请求失败，请检查网络");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  refreshCaptcha();
  refreshDeleteCaptcha();
  // 设置当前月份
  const now = new Date();
  selectedMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  loadStatistics();
  loadMonthlyData();
  loadTicketHistory();
})

async function handleDeleteAccount() {
  const inputCode = deleteCaptchaInput.value.trim().toUpperCase();
  if (inputCode !== deleteCurrentCaptcha) {
    ElMessage.error("验证码错误，请重新输入！");
    refreshDeleteCaptcha();
    return;
  }

  const password = deletePassword.value.trim();
  if (!password) {
    ElMessage.warning("请输入当前密码");
    return;
  }

  const userRaw = localStorage.getItem("user");
  if (!userRaw) {
    ElMessage.error("登录状态失效，请重新登录");
    router.push("/login");
    return;
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch (e) {
    ElMessage.error("用户信息读取失败，请重新登录");
    router.push("/login");
    return;
  }

  try {
    deleting.value = true;
    // 先验证密码
    const response = await api.post("/user/delete-account", {
      id: user.id,
      password: password,
      captcha: inputCode
    });

    if (!response.data.success) {
      ElMessage.error(response.data.message || "验证失败，请稍后重试");
      refreshDeleteCaptcha();
      return;
    }

    // 验证码和密码通过后，弹出最终警告确认
    try {
      await ElMessageBox.confirm(
        "此操作将永久删除您的账户及所有数据，且不可恢复！确定要继续吗？",
        "危险操作确认",
        {
          confirmButtonText: "确认删除",
          cancelButtonText: "取消",
          type: "error",
          confirmButtonClass: "el-button--danger"
        }
      );
    } catch {
      // 用户取消操作
      deleting.value = false;
      return;
    }

    // 用户确认后执行删除
    const deleteResponse = await api.post("/user/confirm-delete", {
      id: user.id
    });

    if (deleteResponse.data.success) {
      ElMessage.success("账户已删除");
      localStorage.removeItem("user");
      localStorage.removeItem("login");
      deleteDialogVisible.value = false;
      router.push("/");
      return;
    }

    ElMessage.error(deleteResponse.data.message || "删除失败，请稍后重试");
  } catch (err) {
    console.error(err);
    ElMessage.error("请求失败，请检查网络");
  } finally {
    deleting.value = false;
  }
}

</script>


<style scoped>
.user-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 10%, rgba(255, 186, 73, 0.22), transparent 40%),
    radial-gradient(circle at 92% 92%, rgba(61, 162, 255, 0.2), transparent 42%),
    linear-gradient(160deg, #f6f8fb 0%, #eef3ff 100%);
}

.user-layout {
  min-height: 100vh;
}

.user-sidebar {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  padding: 20px;
}

.user-main {
  padding: 28px;
}

.user-title-wrap {
  margin-bottom: 20px;
}

.title-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-content h1 {
  margin: 0 0 8px;
  font-size: 32px;
  color: #17324d;
}

.title-content p {
  margin: 0;
  color: #5f6f81;
}

.user-content-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}

.avatar-card,
.profile-card,
.coming-soon-card {
  border-radius: 16px;
}

.avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.profile-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.captcha-group {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 20%;
}

.captcha-group img {
  cursor: pointer;
  height: 40px;
  border-radius: 6px;
}

.coming-soon-card,
.statistics-card {
  margin-top: 20px;
  background: rgba(255, 255, 255, 0.4);
}

.statistics-card h3 {
  margin: 0 0 16px;
}

.chart-container {
  width: 100%;
  height: 320px;
  margin-bottom: 16px;
}

.calendar-wrapper {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.calendar-header span {
  font-weight: 500;
  color: #17324d;
}

.calendar-container {
  width: 100%;
  height: 300px;
}

.map-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed #e0e0e0;
}

.map-section h4 {
  margin: 0 0 16px;
  color: #17324d;
  font-size: 16px;
}

.map-container {
  width: 100%;
  height: 500px;
  border-radius: 12px;
  background: #fff;
}

@media (max-width: 900px) {
  .user-content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
