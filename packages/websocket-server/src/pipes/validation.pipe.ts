import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    // 如果没有元类型或不需要验证，直接返回
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    try {
      // 对于WebSocket消息，value应该是数据部分，不是Socket对象
      const object = plainToClass(metatype, value);
      const errors = await validate(object);

      if (errors.length > 0) {
        console.error('验证错误:', errors);
        throw new BadRequestException('验证失败');
      }

      return object;
    } catch (error) {
      console.error('验证管道错误:', error);
      throw new BadRequestException('数据验证失败');
    }
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
