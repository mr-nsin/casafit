// NestJS DTOs mirror the zod schemas in @casafit/shared.
// Keep them equivalent; the shared schemas are canonical.

import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendCodeDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class VerifyCodeDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @Matches(/^\d{6}$/) @Length(6, 6) code!: string;
}
