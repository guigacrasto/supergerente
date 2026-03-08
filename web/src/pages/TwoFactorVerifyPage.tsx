import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card } from '@/components/ui';
import type { User } from '@/types';

interface VerifyResponse {
  token: string;
  user: User;
  warning?: string;
}

export function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const pendingChallenge = useAuthStore((s) => s.pendingChallenge);
  const clearPendingChallenge = useAuthStore((s) => s.clearPendingChallenge);

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!pendingChallenge) {
      navigate('/login', { replace: true });
    }
    // Focar no primeiro campo
    inputRefs.current[0]?.focus();
  }, [pendingChallenge, navigate]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focar no proximo campo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Enviar automaticamente quando preencher os 6 digitos
    if (value && index === 5 && newCode.every((d) => d)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr || code.join('');
    if (fullCode.length < 6) {
      setError('Digite os 6 digitos.');
      return;
    }

    setError('');
    setWarning('');
    setLoading(true);

    try {
      const { data } = await api.post<VerifyResponse>('/auth/2fa/verify', {
        challengeToken: pendingChallenge,
        code: fullCode,
      });

      if (data.warning) {
        setWarning(data.warning);
      }

      login(data.token, data.user);
      clearPendingChallenge();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao verificar codigo.';
      setError(message);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();

      // Se challenge expirou ou muitas tentativas, voltar pro login
      if (message.includes('login novamente')) {
        setTimeout(() => {
          clearPendingChallenge();
          navigate('/login', { replace: true });
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-heading text-heading-lg">Verificacao 2FA</h1>
        <p className="mt-2 text-center text-body-md text-muted">
          Digite o codigo de 6 digitos do seu app autenticador
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="space-y-6"
      >
        {/* Campo de codigo de 6 digitos */}
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-12 rounded-button border border-white/10 bg-white/5 text-center text-lg font-semibold text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && (
          <div className="rounded-button bg-danger/10 px-3 py-2 text-center text-body-sm text-danger">
            {error}
          </div>
        )}

        {warning && (
          <div className="rounded-button bg-warning/10 px-3 py-2 text-center text-body-sm text-warning">
            {warning}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Verificar
        </Button>

        <p className="text-center text-body-sm text-muted">
          Tambem aceita backup codes
        </p>

        <button
          type="button"
          onClick={() => {
            clearPendingChallenge();
            navigate('/login', { replace: true });
          }}
          className="w-full text-center text-body-sm text-muted hover:text-white"
        >
          Voltar para o login
        </button>
      </form>
    </Card>
  );
}
