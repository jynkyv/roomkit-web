import LibGenerateTestUserSig from '../config/lib-generate-test-usersig-es.min.js';

interface UserSigParams {
  sdkAppId: number;
  userId: string;
  secretKey: string;
  expireTime?: number;
}

/**
 * 生成随机机器人用户ID
 * @returns 随机机器人用户ID
 */
export function generateRandomBotUserId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `transcription_bot_${timestamp}_${random}`;
}

/**
 * 生成 UserSig
 * @param params 生成参数
 * @returns UserSig 字符串
 */
export function generateUserSig(params: UserSigParams): string {
  const { sdkAppId, userId, secretKey, expireTime = 604800 } = params;

  try {
    // 使用腾讯云提供的工具库生成 UserSig
    const generator = new LibGenerateTestUserSig(sdkAppId, secretKey, expireTime);
    const userSig = generator.genTestUserSig(userId);

    return userSig;
  } catch (error) {
    console.error('生成 UserSig 失败:', error);
    throw new Error('生成 UserSig 失败');
  }
}

/**
 * 为机器人用户生成 UserSig
 * @param sdkAppId SDK应用ID
 * @param secretKey 密钥
 * @returns 机器人用户的 UserSig
 */
export function generateRobotUserSig(sdkAppId: number, secretKey: string): string {
  const userId = generateRandomBotUserId();
  return generateUserSig({ sdkAppId, userId, secretKey });
}

/**
 * 生成机器人用户信息（用户ID + UserSig）
 * @param sdkAppId SDK应用ID
 * @param secretKey 密钥
 * @returns 机器人用户信息
 */
export function generateBotUserInfo(sdkAppId: number, secretKey: string): { userId: string; userSig: string } {
  const userId = generateRandomBotUserId();
  const userSig = generateUserSig({ sdkAppId, userId, secretKey });
  return { userId, userSig };
} 
