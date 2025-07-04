require('dotenv').config();
const express = require('express');
const tencentcloud = require('tencentcloud-sdk-nodejs-trtc');
const cors = require('cors')

const TrtcClient = tencentcloud.trtc.v20190722.Client;

// 从环境变量中获取腾讯云账户 SecretId 和 SecretKey
const secretId = process.env.TENCENT_SECRET_ID || 'AKIDqY4jPs7OYYMxNo7HE0abTEqGbny1tdCo';
const secretKey = process.env.TENCENT_SECRET_KEY || 'Yu48EKH3cbP3e2CF8odEfuwoV186tVyI';
const region = process.env.TENCENT_REGION || 'ap-guangzhou';

// 验证密钥配置
if (!secretId || !secretKey) {
  console.error('错误: 请配置腾讯云 API 密钥');
  console.error('请在 .env 文件中设置以下环境变量:');
  console.error('TENCENT_SECRET_ID=您的腾讯云SecretId');
  console.error('TENCENT_SECRET_KEY=您的腾讯云SecretKey');
  console.error('TENCENT_REGION=您的腾讯云地域(可选，默认ap-guangzhou)');
  process.exit(1);
}

// 实例化一个认证对象
const clientConfig = {
  credential: {
    secretId: secretId,
    secretKey: secretKey,
  },
  region: region,
  profile: {
    httpProfile: {
      endpoint: 'trtc.tencentcloudapi.com',
    },
  },
};

const client = new TrtcClient(clientConfig);

const app = express();
app.use(express.json());
app.use(cors());

app.post('/start', async (req, res) => {
  const { SdkAppId, RoomId, RoomIdType = 1, UserId, UserSig } = req.body;
  
  // 验证必要参数
  if (!SdkAppId || !RoomId || !UserId || !UserSig) {
    return res.status(400).json({ 
      error: '缺少必要参数', 
      required: ['SdkAppId', 'RoomId', 'UserId', 'UserSig'],
      received: { SdkAppId, RoomId, RoomIdType, UserId, UserSig }
    });
  }

  const params = {
    SdkAppId: parseInt(SdkAppId),
    RoomId: RoomId,
    RoomIdType: parseInt(RoomIdType),
    TranscriptionParams: {
      UserId: UserId,
      UserSig: UserSig,
    },
  };

  try {
    console.log('启动 AI 转写任务，参数:', JSON.stringify(params, null, 2));
    const data = await client.StartAITranscription(params);
    console.log('AI 转写任务启动成功:', data);
    res.status(200).json(data);
  } catch (err) {
    console.error('启动 AI 转写任务失败:', err);
    
    // 根据错误类型返回不同的错误信息
    if (err.code === 'AuthFailure.SignatureFailure') {
      res.status(401).json({ 
        error: '腾讯云 API 密钥验证失败，请检查 SecretId 和 SecretKey 是否正确',
        details: err.message 
      });
    } else if (err.code === 'InvalidParameter') {
      res.status(400).json({ 
        error: '参数错误，请检查传入的参数是否正确',
        details: err.message 
      });
    } else {
      res.status(500).json({ 
        error: '服务器内部错误',
        details: err.message 
      });
    }
  }
});

app.post('/stop', async (req, res) => {
  const { TaskId } = req.body;

  if (!TaskId) {
    return res.status(400).json({ 
      error: '缺少必要参数 TaskId',
      received: { TaskId }
    });
  }

  try {
    console.log('停止 AI 转写任务，TaskId:', TaskId);
    const data = await client.StopAITranscription({ TaskId: TaskId });
    console.log('AI 转写任务停止成功:', data);
    res.status(200).json(data);
  } catch (err) {
    console.error('停止 AI 转写任务失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'AI 转写服务运行正常',
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI 转写服务器运行在端口 ${port}`);
  console.log(`健康检查: http://localhost:${port}/health`);
  console.log(`腾讯云配置: SecretId=${secretId.substring(0, 8)}..., Region=${region}`);
});
