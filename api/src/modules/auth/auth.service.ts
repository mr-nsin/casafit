import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { normaliseEmail, normalisePhoneE164 } from '@casafit/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import type { SendCodeDto, VerifyCodeDto } from './dto';

type Identifier = { kind: 'phone' | 'email'; value: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
  ) {}

  async sendCode(dto: SendCodeDto): Promise<{ resendInSeconds: number; attemptsLeftThisHour: number }> {
    const id = this.identifier(dto);
    return this.otp.send(id.value);
  }

  async verify(dto: VerifyCodeDto): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewAccount: boolean;
    freeChecksRemaining: number;
    pro: { active: boolean; expiresAt: string | null };
  }> {
    const id = this.identifier(dto);
    const result = this.otp.verify(id.value, dto.code);
    if (result !== 'ok') throw new UnauthorizedException(result);

    const existing =
      id.kind === 'phone'
        ? await this.prisma.account.findUnique({ where: { phoneE164: id.value } })
        : await this.prisma.account.findUnique({ where: { emailNorm: id.value } });

    const account =
      existing ??
      (await this.prisma.account.create({
        data:
          id.kind === 'phone'
            ? { phoneE164: id.value }
            : { emailNorm: id.value },
      }));

    const accessToken = await this.jwt.signAsync({ sub: account.id });
    const refreshToken = await this.jwt.signAsync({ sub: account.id, kind: 'refresh' }, { expiresIn: '30d' });

    return {
      accessToken,
      refreshToken,
      isNewAccount: !existing,
      freeChecksRemaining: account.freeChecksRemaining,
      pro: { active: account.proActive, expiresAt: account.proExpiresAt?.toISOString() ?? null },
    };
  }

  private identifier(dto: SendCodeDto | VerifyCodeDto): Identifier {
    const hasPhone = !!dto.phone;
    const hasEmail = !!dto.email;
    if (hasPhone === hasEmail) {
      throw new BadRequestException('Provide exactly one of phone or email');
    }
    try {
      return hasPhone
        ? { kind: 'phone', value: normalisePhoneE164(dto.phone!) }
        : { kind: 'email', value: normaliseEmail(dto.email!) };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
