import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    headers: { 'X-CRTicket-Request': '1' },
    timeout: 5000,  // 请求超时
    withCredentials: true,
});

export default api;
