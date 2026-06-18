import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api',  // 后端地址
    timeout: 5000,  // 请求超时
    withCredentials: true,
});

export default api;
