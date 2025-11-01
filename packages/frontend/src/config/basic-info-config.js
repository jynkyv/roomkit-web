/*
 * @Description: Basic information configuration for TUIRoomKit applications
 */

import LibGenerateTestUserSig from './lib-generate-test-usersig-es.min';

/**
 * Tencent Cloud SDKAppId, which should be replaced with user's SDKAppId.
 * Enter Tencent Cloud TRTC [Console] (https://console.cloud.tencent.com/trtc ) to create an application,
 * and you will see the SDKAppId.
 * It is a unique identifier used by Tencent Cloud to identify users.
 *
 */

// 从环境变量读取（如果未配置则为 undefined）
const envAppId = import.meta.env.VITE_TENCENT_SDK_APP_ID;
const envSecretKey = import.meta.env.VITE_TENCENT_SDK_SECRET_KEY;

export const SDKAPPID = envAppId ? Number(envAppId) : 0;
export const SDKSECRETKEY = envSecretKey || '';

/**
 * Signature expiration time, which should not be too short
 * Time unit: second
 * Default time: 7 * 24 * 60 * 60 = 604800 = 7days
 *
 */
export const EXPIRETIME = 604800;

/**
 * Set user information on the push side
 *
 */
export const userInfo = {
  // UserId
  userId: `user_${Math.ceil(Math.random() * 100000)}`,
  // UserName
  userName: 'myName',
  // UserAvatar
  avatarUrl: '',
};

/**
 * 修改 getBasicInfo 函数，接收真实的用户信息
 */
export function getBasicInfo(user = null) {
  // 检查环境变量是否配置
  const appId = envAppId;
  const secretKey = envSecretKey;
  
  if (!appId || !secretKey || appId === '0' || secretKey === '' || isNaN(Number(appId))) {
    console.error('❌ 腾讯云SDK配置未设置！');
    console.error('请在项目根目录创建 packages/frontend/.env.production 文件，并配置：');
    console.error('   VITE_TENCENT_SDK_APP_ID=你的SDKAppID');
    console.error('   VITE_TENCENT_SDK_SECRET_KEY=你的SecretKey');
    console.error('或者在本地创建 .env 文件（用于开发环境）');
    
    // 返回 null 而不是 undefined，让调用者可以检查
    return null;
  }

  // 如果有真实用户信息，使用真实用户信息；否则使用默认测试用户信息
  let userInfo;
  if (user && user.id) {
    userInfo = {
      userId: user.id,
      userName: user.name || user.email || 'User',
      avatarUrl: user.avatar_url || '',
    };
  } else {
    // 默认测试用户信息（不应该到这里，因为已经有认证了）
    userInfo = {
      userId: `user_${Math.ceil(Math.random() * 100000)}`,
      userName: 'Guest',
      avatarUrl: '',
    };
  }

  console.log('生成 userSig 的用户ID:', userInfo.userId);
  const generator = new LibGenerateTestUserSig(SDKAPPID, SDKSECRETKEY, EXPIRETIME);
  const userSig = generator.genTestUserSig(userInfo.userId);
  console.log('生成的 userSig:', userSig);
  
  return {
    sdkAppId: SDKAPPID,
    userId: userInfo.userId,
    userSig,
    userName: userInfo.userName,
    avatarUrl: userInfo.avatarUrl,
  };
};
