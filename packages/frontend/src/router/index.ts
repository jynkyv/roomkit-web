import { createRouter, createWebHashHistory } from 'vue-router';
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
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  // 防止重复导航
  if (to.name === from.name && to.params === from.params) {
    next(false);
    return;
  }

  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore();
    
    // 如果还没有初始化认证状态，先初始化
    if (!authStore.user && !authStore.loading) {
      await authStore.initAuth();
    }
    
    // 如果未登录，重定向到登录页
    if (!authStore.isAuthenticated) {
      next('/login');
      return;
    }
  }

  next();
});

export default router;
