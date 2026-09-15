import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class RegisterDto extends BaseMessageDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() fullName!: string;
}

export class LoginDto extends BaseMessageDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class FindByEmailDto extends BaseMessageDto {
  @IsEmail() email!: string;
}

export class GetUserDto extends BaseMessageDto {
  @IsUUID() userId!: string;
}

export class ValidateTokenDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() token!: string;
}

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface TokenClaims {
  userId: string;
  email: string;
}
