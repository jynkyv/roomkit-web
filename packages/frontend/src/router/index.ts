import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/login',
    component: () => import('@/views/login.vue'),
  },
  {
    path: '/home',
    component: () => import('@/views/home.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/room',
    component: () => import('@/views/room.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  // 防止重复导航
  if (to.name === from.name && to.params === from.params) {
    next(false);
    return;
  }

  // 检查是否需要认证（有用户名即可）
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore();
    
    // 如果还没有初始化认证状态，先初始化
    if (!authStore.user && !authStore.loading) {
      await authStore.initAuth();
    }
    
    // 如果未登录（没有用户名），重定向到登录页并带上redirect参数
    if (!authStore.isAuthenticated) {
      next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
      return;
    }
  }

  next();
});

export default router;
