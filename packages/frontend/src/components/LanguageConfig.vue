<template>
  <div class="language-config">
    <div class="config-header">
      <h3>{{ t('Translation Language Settings') }}</h3>
      <p>{{ t('Configure your source and target languages for translation') }}</p>
    </div>
    
    <div class="config-content">
      <div class="language-selector">
        <div class="language-group">
          <label>{{ t('I speak') }}</label>
          <select v-model="sourceLanguage" @change="updateConfig">
            <option value="zh-CHS">中文</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        
        <div class="arrow">→</div>
        
        <div class="language-group">
          <label>{{ t('I want to translate to') }}</label>
          <select v-model="targetLanguage" @change="updateConfig">
            <option value="ja">日本語</option>
            <option value="zh-CHS">中文</option>
          </select>
        </div>
      </div>
      
      <div class="config-actions">
        <button @click="saveConfig" class="save-btn">
          {{ t('Save Configuration') }}
        </button>
        <button @click="cancelConfig" class="cancel-btn">
          {{ t('Cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../locales';

// Props
interface Props {
  showConfig: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:showConfig': [value: boolean];
  'config-saved': [config: { sourceLanguage: string; targetLanguage: string }];
}>();

// 国际化
const { t } = useI18n();

// 响应式数据
const sourceLanguage = ref('zh-CHS');
const targetLanguage = ref('ja');

// 方法
const updateConfig = () => {
  // 确保源语言和目标语言不同
  if (sourceLanguage.value === targetLanguage.value) {
    if (sourceLanguage.value === 'zh-CHS') {
      targetLanguage.value = 'ja';
    } else {
      targetLanguage.value = 'zh-CHS';
    }
  }
};

const saveConfig = () => {
  const config = {
    sourceLanguage: sourceLanguage.value,
    targetLanguage: targetLanguage.value,
  };
  
  // 保存到localStorage
  localStorage.setItem('translation-language-config', JSON.stringify(config));
  
  // 触发保存事件
  emit('config-saved', config);
  emit('update:showConfig', false);
  
  console.log('语言配置已保存:', config);
};

const cancelConfig = () => {
  emit('update:showConfig', false);
};

// 加载已保存的配置
const loadSavedConfig = () => {
  try {
    const savedConfig = localStorage.getItem('translation-language-config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      sourceLanguage.value = config.sourceLanguage || 'zh-CHS';
      targetLanguage.value = config.targetLanguage || 'ja';
    }
  } catch (error) {
    console.error('加载语言配置失败:', error);
  }
};

// 组件挂载时加载配置
onMounted(() => {
  loadSavedConfig();
});
</script>

<style scoped>
.language-config {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 100%;
}

.config-header {
  text-align: center;
  margin-bottom: 24px;
}

.config-header h3 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.config-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.language-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.language-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}

.language-group label {
  font-size: 14px;
  color: #555;
  font-weight: 500;
  text-align: center;
}

.language-group select {
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: border-color 0.3s;
}

.language-group select:focus {
  outline: none;
  border-color: #007bff;
}

.arrow {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin: 0 10px;
}

.config-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.save-btn, .cancel-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.save-btn {
  background: #007bff;
  color: white;
}

.save-btn:hover {
  background: #0056b3;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background: #5a6268;
}

@media (max-width: 480px) {
  .language-config {
    padding: 20px;
    margin: 10px;
  }
  
  .language-selector {
    flex-direction: column;
    gap: 15px;
  }
  
  .arrow {
    transform: rotate(90deg);
    margin: 5px 0;
  }
  
  .config-actions {
    flex-direction: column;
  }
}
</style>
