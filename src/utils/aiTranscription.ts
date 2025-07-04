import axios from 'axios';

// AI转录任务管理
export class AITranscriptionManager {
  private secretId: string;
  private secretKey: string;
  private sdkAppId: number;
  private region: string;

  constructor(secretId: string, secretKey: string, sdkAppId: number, region: string = 'ap-guangzhou') {
    this.secretId = secretId;
    this.secretKey = secretKey;
    this.sdkAppId = sdkAppId;
    this.region = region;
  }

  /**
   * 启动AI转录任务
   * @param roomId 房间ID
   * @param userId 用户ID
   * @param userSig 用户签名
   * @param transcriptionMode 转录模式：0-全房间，1-指定用户
   * @param targetUserId 目标用户ID（转录模式为1时必填）
   * @param sessionId 会话ID（可选）
   */
  async startTranscription(
    roomId: string,
    userId: string,
    userSig: string,
    transcriptionMode: number = 0,
    targetUserId?: string,
    sessionId?: string,
  ) {
    const params = {
      SdkAppId: this.sdkAppId,
      RoomId: roomId,
      RoomIdType: 1, // 字符串房间号
      TranscriptionParams: {
        UserId: userId,
        UserSig: userSig,
        MaxIdleTime: 60,
        TranscriptionMode: transcriptionMode,
        ...(targetUserId && { TargetUserId: targetUserId }),
        ...(sessionId && { SessionId: sessionId }),
      },
    };

    try {
      const response = await this.callTRTCAPI('StartAITranscription', params);
      return response.TaskId;
    } catch (error) {
      console.error('启动AI转录任务失败:', error);
      throw error;
    }
  }

  /**
   * 查询AI转录任务状态
   * @param taskId 任务ID
   */
  async queryTranscription(taskId: string) {
    const params = {
      SdkAppId: this.sdkAppId,
      TaskId: taskId,
    };

    try {
      const response = await this.callTRTCAPI('DescribeAITranscription', params);
      return response;
    } catch (error) {
      console.error('查询AI转录任务失败:', error);
      throw error;
    }
  }

  /**
   * 停止AI转录任务
   * @param taskId 任务ID
   */
  async stopTranscription(taskId: string) {
    const params = {
      SdkAppId: this.sdkAppId,
      TaskId: taskId,
    };

    try {
      const response = await this.callTRTCAPI('StopAITranscription', params);
      return response;
    } catch (error) {
      console.error('停止AI转录任务失败:', error);
      throw error;
    }
  }

  /**
   * 调用TRTC API
   */
  private async callTRTCAPI(action: string, params: any) {
    // 这里需要实现腾讯云API的签名认证
    // 由于前端直接调用API存在安全风险，建议通过后端代理
    const response = await axios.post('/api/trtc', {
      action,
      params,
      secretId: this.secretId,
      secretKey: this.secretKey,
      region: this.region,
    });

    return response.data;
  }
}

// 客户端转录消息处理
export class TranscriptionMessageHandler {
  private conference: any;
  private onSubtitleCallback?: (subtitle: SubtitleMessage) => void;
  private onTranscriptionCallback?: (transcription: TranscriptionMessage) => void;

  constructor(conference: any) {
    this.conference = conference;
    this.initMessageListener();
  }

  /**
   * 初始化消息监听
   */
  private initMessageListener() {
    // 监听自定义消息（可能包含转录数据）
    this.conference.on('customMessage', (event: any) => {
      this.handleCustomMessage(event);
    });

    // 监听TRTC的转录消息
    this.conference.on('transcriptionMessage', (event: any) => {
      this.handleTranscriptionMessage(event);
    });

    // 监听字幕消息
    this.conference.on('subtitleMessage', (event: any) => {
      this.handleSubtitleMessage(event);
    });

    // 监听所有消息，用于调试
    this.conference.on('message', (event: any) => {
      console.log('收到TRTC消息:', event);
      this.handleGenericMessage(event);
    });
  }

  /**
   * 处理自定义消息
   */
  private handleCustomMessage(event: any) {
    try {
      console.log('收到自定义消息:', event);
      const data = new TextDecoder().decode(event.data);
      const message = JSON.parse(data);

      if (message.type === 10000) {
        // 实时字幕消息
        const subtitleMessage: SubtitleMessage = {
          type: 'subtitle',
          sender: message.sender,
          text: message.payload.text,
          startTime: message.payload.start_time,
          endTime: message.payload.end_time,
          isComplete: message.payload.end,
        };

        this.onSubtitleCallback?.(subtitleMessage);
      }
    } catch (error) {
      console.error('解析自定义消息失败:', error);
    }
  }

  /**
   * 处理转录消息
   */
  private handleTranscriptionMessage(event: any) {
    try {
      console.log('收到转录消息:', event);
      const subtitleMessage: SubtitleMessage = {
        type: 'subtitle',
        sender: event.sender || event.userId || 'unknown',
        text: event.text || event.content || '',
        startTime: event.startTime || event.start_time || '',
        endTime: event.endTime || event.end_time || '',
        isComplete: event.isComplete || event.end || false,
      };

      this.onSubtitleCallback?.(subtitleMessage);
    } catch (error) {
      console.error('解析转录消息失败:', error);
    }
  }

  /**
   * 处理字幕消息
   */
  private handleSubtitleMessage(event: any) {
    try {
      console.log('收到字幕消息:', event);
      const subtitleMessage: SubtitleMessage = {
        type: 'subtitle',
        sender: event.sender || event.userId || 'unknown',
        text: event.text || event.content || '',
        startTime: event.startTime || event.start_time || '',
        endTime: event.endTime || event.end_time || '',
        isComplete: event.isComplete || event.end || false,
      };

      this.onSubtitleCallback?.(subtitleMessage);
    } catch (error) {
      console.error('解析字幕消息失败:', error);
    }
  }

  /**
   * 处理通用消息（用于调试）
   */
  private handleGenericMessage(event: any) {
    // 检查是否是转录相关的消息
    if (event.type && (event.type.includes('transcription') || event.type.includes('subtitle'))) {
      console.log('检测到转录相关消息:', event);
      this.handleTranscriptionMessage(event);
    }
  }

  /**
   * 设置字幕回调
   */
  onSubtitle(callback: (subtitle: SubtitleMessage) => void) {
    this.onSubtitleCallback = callback;
  }

  /**
   * 设置转录回调
   */
  onTranscription(callback: (transcription: TranscriptionMessage) => void) {
    this.onTranscriptionCallback = callback;
  }
}

// 类型定义
export interface SubtitleMessage {
  type: 'subtitle';
  sender: string;
  text: string;
  startTime: string;
  endTime: string;
  isComplete: boolean;
}

export interface TranscriptionMessage {
  type: 'transcription';
  sender: string;
  text: string;
  startTime: string;
  endTime: string;
}
