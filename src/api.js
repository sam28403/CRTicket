import axios from 'axios';

// 时刻表首次下载最多 90 秒，另预留在线查询和数据处理时间。
export const timetableTimeout = 150000;

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    headers: { 'X-CRTicket-Request': '1' },
    timeout: 5000,  // 请求超时
    withCredentials: true,
});

export default api;
