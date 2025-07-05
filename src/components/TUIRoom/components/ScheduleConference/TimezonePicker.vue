<template>
  <div class="container">
    <TuiSelect
      v-model="selectedTime"
      :teleported="false"
      :custom-select-content-style="{ 'font-weight': 400 }"
      :value="selectedTime"
      @input="selectedTime = $event"
    >
      <TuiOption
        v-for="time in timeOptions"
        :key="time.value"
        :value="time.value"
        :label="time.label"
        :custom-option-content-style="{ 'font-weight': 400 }"
      />
    </TuiSelect>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  defineProps,
  defineEmits,
  watch,
  onMounted,
  onUnmounted,
} from 'vue';
import TuiSelect from '../common/base/Select';
import TuiOption from '../common/base/Option';
import { roomService, EventType, LanguageOption } from '../../services';

interface Props {
  modelValue: string;
}
const props = defineProps<Props>();
const emit = defineEmits(['input']);
const selectedTime = ref(props.modelValue);
const currentLanguage = ref(roomService.basicStore.lang);
const timeOptions = computed(() => {
  switch (currentLanguage.value) {
    case 'zh-CN':
      return timeOptionsCh.value;
    case 'ja-JP':
      return timeOptionsJa.value;
    default:
      return timeOptionsCh.value;
  }
});
const timeOptionsCh = computed(() => [
  { label: 'GMT-12:00 世界时 - 国际日期变更线西', value: 'Etc/GMT+12' },
  { label: 'GMT-11:00 世界时 - 协调世界时-11', value: 'Etc/GMT+11' },
  { label: 'GMT-10:00 夏威夷 - 阿留申标准时间', value: 'Pacific/Honolulu' },
  { label: 'GMT-09:00 阿拉斯加标准时间', value: 'America/Anchorage' },
  { label: 'GMT-08:00 太平洋标准时间', value: 'America/Los_Angeles' },
  { label: 'GMT-07:00 美国山地标准时间', value: 'America/Denver' },
  { label: 'GMT-06:00 美国中部标准时间', value: 'America/Chicago' },
  { label: 'GMT-05:00 美国东部标准时间', value: 'America/New_York' },
  { label: 'GMT-04:00 大西洋标准时间', value: 'America/Halifax' },
  {
    label: 'GMT-03:00 阿根廷标准时间',
    value: 'America/Argentina/Buenos_Aires',
  },
  { label: 'GMT-02:00 协调世界时-02', value: 'Etc/GMT+2' },
  { label: 'GMT-01:00 佛得角标准时间', value: 'Atlantic/Cape_Verde' },
  { label: 'GMT+00:00 格林威治标准时间', value: 'Europe/London' },
  { label: 'GMT+01:00 中欧标准时间', value: 'Europe/Berlin' },
  { label: 'GMT+02:00 东欧标准时间', value: 'Europe/Kiev' },
  { label: 'GMT+03:00 莫斯科标准时间', value: 'Europe/Moscow' },
  { label: 'GMT+04:00 阿布扎比标准时间', value: 'Asia/Dubai' },
  { label: 'GMT+05:00 巴基斯坦标准时间', value: 'Asia/Karachi' },
  { label: 'GMT+05:30 印度标准时间', value: 'Asia/Kolkata' },
  { label: 'GMT+06:00 孟加拉国标准时间', value: 'Asia/Dhaka' },
  { label: 'GMT+07:00 泰国标准时间', value: 'Asia/Bangkok' },
  { label: 'GMT+08:00 中国标准时间 - 北京', value: 'Asia/Shanghai' },
  { label: 'GMT+09:00 日本标准时间', value: 'Asia/Tokyo' },
  { label: 'GMT+10:00 澳大利亚东部标准时间 - 悉尼', value: 'Australia/Sydney' },
  { label: 'GMT+11:00 所罗门群岛标准时间', value: 'Pacific/Guadalcanal' },
  { label: 'GMT+12:00 新西兰标准时间', value: 'Pacific/Auckland' },
  { label: 'GMT+13:00 汤加标准时间', value: 'Pacific/Tongatapu' },
]);

const timeOptionsJa = computed(() => [
  { label: 'GMT-12:00 国際日付変更線西', value: 'Etc/GMT+12' },
  { label: 'GMT-11:00 協定世界時-11', value: 'Etc/GMT+11' },
  {
    label: 'GMT-10:00 ハワイ・アリューシャン標準時',
    value: 'Pacific/Honolulu',
  },
  { label: 'GMT-09:00 アラスカ標準時', value: 'America/Anchorage' },
  { label: 'GMT-08:00 太平洋標準時', value: 'America/Los_Angeles' },
  { label: 'GMT-07:00 山地標準時', value: 'America/Denver' },
  { label: 'GMT-06:00 中部標準時', value: 'America/Chicago' },
  { label: 'GMT-05:00 東部標準時', value: 'America/New_York' },
  { label: 'GMT-04:00 大西洋標準時', value: 'America/Halifax' },
  {
    label: 'GMT-03:00 アルゼンチン標準時',
    value: 'America/Argentina/Buenos_Aires',
  },
  { label: 'GMT-02:00 協定世界時-02', value: 'Etc/GMT+2' },
  { label: 'GMT-01:00 カーボベルデ標準時', value: 'Atlantic/Cape_Verde' },
  { label: 'GMT+00:00 グリニッジ標準時', value: 'Europe/London' },
  { label: 'GMT+01:00 中央ヨーロッパ標準時', value: 'Europe/Berlin' },
  { label: 'GMT+02:00 東ヨーロッパ標準時', value: 'Europe/Kiev' },
  { label: 'GMT+03:00 モスクワ標準時', value: 'Europe/Moscow' },
  { label: 'GMT+04:00 湾岸標準時', value: 'Asia/Dubai' },
  { label: 'GMT+05:00 パキスタン標準時', value: 'Asia/Karachi' },
  { label: 'GMT+05:30 インド標準時', value: 'Asia/Kolkata' },
  { label: 'GMT+06:00 バングラデシュ標準時', value: 'Asia/Dhaka' },
  { label: 'GMT+07:00 インドシナ時間', value: 'Asia/Bangkok' },
  { label: 'GMT+08:00 中国標準時 - 北京', value: 'Asia/Shanghai' },
  { label: 'GMT+09:00 日本標準時', value: 'Asia/Tokyo' },
  {
    label: 'GMT+10:00 オーストラリア東部標準時 - シドニー',
    value: 'Australia/Sydney',
  },
  {
    label: 'GMT+11:00 ソロモン諸島標準時',
    value: 'Pacific/Guadalcanal',
  },
  { label: 'GMT+12:00 ニュージーランド標準時', value: 'Pacific/Auckland' },
  { label: 'GMT+13:00 トンガ標準時', value: 'Pacific/Tongatapu' },
]);
const handleLanguageChange = async (language: LanguageOption) => {
  currentLanguage.value = language;
};
onMounted(() => {
  roomService.on(EventType.LANGUAGE_CHANGED, handleLanguageChange);
});

onUnmounted(() => {
  roomService.off(EventType.LANGUAGE_CHANGED, handleLanguageChange);
});

const updateTime = () => {
  emit('input', selectedTime.value);
};

watch(
  selectedTime,
  () => {
    updateTime();
  },
  {
    immediate: true,
  }
);
watch(
  () => props.modelValue,
  newValue => {
    selectedTime.value = newValue;
  },
  { immediate: true }
);
</script>
