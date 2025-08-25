import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class TranslationMessageDto {
  @IsString()
  @IsNotEmpty()
  original: string;

  @IsString()
  @IsNotEmpty()
  translation: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  oriLang: string;

  @IsString()
  @IsNotEmpty()
  targetLang: string;

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
