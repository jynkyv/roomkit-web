const express = require('express');
const cors = require('cors');
const tencentcloud = require('tencentcloud-sdk-nodejs');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const TrtcClient = tencentcloud.trtc.v20190722.Client;

const clientConfig = {
  credential: {
    secretId: 'AKIDqY4jPs7OYYMxNo7HE0abTEqGbny1tdCo',
    secretKey: 'Yu48EKH3cbP3e2CF8odEfuwoV186tVyI',
  },
  region: 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: 'trtc.tencentcloudapi.com',
    },
  },
};

const client = new TrtcClient(clientConfig);

// TRTC API代理路由
app.post('/api/trtc', async (req, res) => {
  console.log('收到TRTC API请求:', {
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers
  });
  
  try {
    const { action, params, secretId, secretKey, region } = req.body;
    
    if (!secretId || !secretKey) {
      console.log('缺少认证信息');
      return res.status(400).json({ error: '缺少必要的认证信息' });
    }
    
    // 更新客户端配置
    clientConfig.credential.secretId = secretId;
    clientConfig.credential.secretKey = secretKey;
    clientConfig.region = region || 'ap-guangzhou';
    
    console.log('发送请求到腾讯云:', {
      action,
      params
    });
    
    let result;
    if (action === 'StartAITranscription') {
      console.log('请求腾讯云参数:', params);
      console.log('当前 SecretId:', clientConfig.credential.secretId);
      console.log('当前 SecretKey:', clientConfig.credential.secretKey);
      console.log('当前 region:', clientConfig.region);
      result = await client.StartAITranscription(params);
    } else if (action === 'StopAITranscription') {
      // StopAITranscription 只需要 TaskId 参数
      const stopParams = {
        TaskId: params.TaskId,
      };
      console.log('停止转录任务参数:', stopParams);
      result = await client.StopAITranscription(stopParams);
    } else if (action === 'DescribeAITranscription') {
      // DescribeAITranscription 只需要 TaskId 参数
      const describeParams = {
        TaskId: params.TaskId,
      };
      console.log('查询转录任务参数:', describeParams);
      result = await client.DescribeAITranscription(describeParams);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    
    console.log('腾讯云响应:', result);
    res.json(result);
  } catch (error) {
    console.error('请求腾讯云失败:', error);
    res.status(500).json({
      error: error.toString(),
      detail: error?.response?.data
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`TRTC代理服务器运行在端口 ${PORT}`);
});

module.exports = app; 
