import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendCodeDto, VerifyCodeDto } from './dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('code')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a 6-digit code to the given phone or email' })
  sendCode(@Body() dto: SendCodeDto) {
    return this.auth.sendCode(dto);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a 6-digit code and return session tokens' })
  verify(@Body() dto: VerifyCodeDto) {
    return this.auth.verify(dto);
  }
}
