// In-memory OTP store for scaffold. In production this moves to Redis
// (see docs/architecture.md §3.1) with 5-minute TTL and send-rate counters.

import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';

type Pending = { code: string; attempts: number; createdAt: number };

@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);
  private readonly byKey = new Map<string, Pending>();
  private readonly sentThisHour = new Map<string, { count: number; windowStart: number }>();

  send(key: string): { resendInSeconds: number; attemptsLeftThisHour: number } {
    const hour = this.sentThisHour.get(key);
    const now = Date.now();
    const window = hour && now - hour.windowStart < 3_600_000 ? hour : { count: 0, windowStart: now };
    if (window.count >= 5) {
      return { resendInSeconds: Math.ceil((3_600_000 - (now - window.windowStart)) / 1000), attemptsLeftThisHour: 0 };
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.byKey.set(key, { code, attempts: 0, createdAt: now });
    window.count += 1;
    this.sentThisHour.set(key, window);
    const provider = process.env.SMS_PROVIDER ?? 'log';
    if (provider === 'log') this.log.log(`[dev] OTP for ${key}: ${code}`);
    return { resendInSeconds: 30, attemptsLeftThisHour: 5 - window.count };
  }

  verify(key: string, code: string): 'ok' | 'wrong' | 'expired' | 'no_tries_left' {
    const p = this.byKey.get(key);
    if (!p) return 'expired';
    if (Date.now() - p.createdAt > 300_000) {
      this.byKey.delete(key);
      return 'expired';
    }
    if (p.attempts >= 3) {
      this.byKey.delete(key);
      return 'no_tries_left';
    }
    p.attempts += 1;
    if (p.code !== code) return 'wrong';
    this.byKey.delete(key);
    return 'ok';
  }
}
