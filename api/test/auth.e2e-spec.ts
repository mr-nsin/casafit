import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

// This test does not touch Postgres; it stubs PrismaService.
// A full e2e test should run against Testcontainers; see docs/plans/onboarding.md task 11.

class PrismaMock {
  readonly account = {
    findUnique: async () => null,
    create: async ({ data }: { data: Record<string, unknown> }) => ({
      id: '11111111-1111-1111-1111-111111111111',
      ...data,
      freeChecksRemaining: 2,
      proActive: false,
      proExpiresAt: null,
    }),
  };
}

describe('POST /v1/auth/code and /v1/auth/verify', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaMock as any)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request with both phone and email', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/code')
      .send({ phone: '9876543210', email: 'x@y.com' })
      .expect(400);
  });

  it('sends a code and returns resend timing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/code')
      .send({ phone: '9876543210' })
      .expect(200);
    expect(res.body.resendInSeconds).toBe(30);
    expect(res.body.attemptsLeftThisHour).toBeGreaterThanOrEqual(0);
  });

  it('rejects a wrong code', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/code')
      .send({ phone: '9876543210' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/verify')
      .send({ phone: '9876543210', code: '000000' })
      .expect(401);
  });
});
