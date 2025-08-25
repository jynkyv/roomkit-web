<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { UIKitProvider } from '@tencentcloud/uikit-base-component-vue3';

// 监听历史记录切换事件
const handleToggleHistory = (event: CustomEvent) => {
  // 已移除历史记录功能
};

onMounted(() => {
  // window.addEventListener('toggle-translation-history', handleToggleHistory as EventListener);
});

onUnmounted(() => {
  // window.removeEventListener('toggle-translation-history', handleToggleHistory as EventListener);
});
</script>

<template>
  <UIKitProvider :theme="{ themeStyle: 'light', primaryColor: 'theme' }">
    <div id="app">
      <router-view />
      <!-- 移除SubtitleOverlay组件 -->
    </div>
  </UIKitProvider>
</template>

<style lang="scss">
  html,body,#app{
        height: 100%;
    }
  #app {
    overflow: hidden;
  }
</style>
