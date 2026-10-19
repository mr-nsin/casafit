import { OtpService } from './otp.service';

describe('OtpService', () => {
  let otp: OtpService;
  beforeEach(() => {
    otp = new OtpService();
  });

  it('sends a code and verifies the exact same code', () => {
    const spy = jest.spyOn(otp as unknown as { log: { log: (m: string) => void } }['log'], 'log' as never);
    otp.send('+919876543210');
    // The dev provider logs the code; we pull it from the first log call.
    const line = (spy.mock.calls[0]?.[0] as string) ?? '';
    const code = line.slice(-6);
    expect(otp.verify('+919876543210', code)).toBe('ok');
  });

  it('rejects wrong codes and expires after 3 tries', () => {
    otp.send('+919876543211');
    expect(otp.verify('+919876543211', '000001')).toBe('wrong');
    expect(otp.verify('+919876543211', '000002')).toBe('wrong');
    expect(otp.verify('+919876543211', '000003')).toBe('wrong');
    expect(otp.verify('+919876543211', '000004')).toBe('no_tries_left');
  });

  it('caps the hourly send count at 5', () => {
    for (let i = 0; i < 5; i++) otp.send('+919876543212');
    const sixth = otp.send('+919876543212');
    expect(sixth.attemptsLeftThisHour).toBe(0);
    expect(sixth.resendInSeconds).toBeGreaterThan(0);
  });
});
