import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class TranslationMessageDto {
  @IsString()
  @IsNotEmpty()
  zhText: string;

  @IsString()
  @IsNotEmpty()
  jaText: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  timestamp: number;
}

export class UserJoinDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}
