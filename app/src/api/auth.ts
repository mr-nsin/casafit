import { useMutation } from '@tanstack/react-query';
import type { SendCodeRequest, SendCodeResponse, VerifyCodeRequest, VerifyCodeResponse } from '@casafit/shared';
import { api } from './client';
import { useAuth } from '@/state/auth';

export function useSendCode() {
  return useMutation<SendCodeResponse, Error, SendCodeRequest>({
    mutationFn: (body) => api('/auth/code', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useVerifyCode() {
  const save = useAuth((s) => s.save);
  return useMutation<VerifyCodeResponse, Error, VerifyCodeRequest>({
    mutationFn: async (body) => {
      const res = await api<VerifyCodeResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await save(res);
      return res;
    },
  });
}
