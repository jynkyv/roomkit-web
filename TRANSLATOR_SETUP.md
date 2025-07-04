# 实时翻译功能配置

## 功能说明
本项目集成了基于有道智云API的实时语音翻译功能，可以在会议过程中实时翻译语音内容。

## 配置步骤

### 1. 申请有道智云API
1. 访问 [有道智云官网](https://ai.youdao.com/)
2. 注册账号并创建应用
3. 获取应用的 `APP_KEY` 和 `APP_SECRET`

### 2. 配置环境变量
在项目根目录创建 `.env` 文件，添加以下配置：

```env
VITE_YOUDAO_APP_KEY=your_app_key_here
VITE_YOUDAO_APP_SECRET=your_app_secret_here
```

请将 `your_app_key_here` 和 `your_app_secret_here` 替换为您的实际API密钥。

### 3. 使用方法
1. 进入会议页面
2. 点击右上角的 🌐 按钮打开翻译功能
3. 选择源语言和目标语言
4. 点击"开始翻译"按钮开始录音翻译
5. 实时查看识别结果和翻译结果

## 支持的语言
- 中文 (zh-CHS)
- 英语 (en)
- 日语 (ja)
- 韩语 (ko)

## 注意事项
- 需要浏览器支持麦克风权限
- 建议在安静的环境中使用以获得更好的识别效果
- 翻译功能需要网络连接 
