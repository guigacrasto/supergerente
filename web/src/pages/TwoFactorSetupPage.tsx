import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Copy, CheckCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, Input } from '@/components/ui';

interface SetupResponse {
  qrCode: string;
  secret: string;
}

interface VerifySetupResponse {
  message: string;
  backupCodes: string[];
}

export function TwoFactorSetupPage() {
  const navigate = useNavigate();
  const setRequires2FASetup = useAuthStore((s) => s.setRequires2FASetup);
  const user = useAuthStore((s) => s.user);
  const isRequired = user?.role === 'admin' || user?.role === 'superadmin';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Etapa 1: Gerar QR code
  const handleSetup = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<SetupResponse>('/auth/2fa/setup');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep(2);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao iniciar configuracao 2FA.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Etapa 2: Verificar codigo
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Digite os 6 digitos.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<VerifySetupResponse>('/auth/2fa/verify-setup', { code });
      setBackupCodes(data.backupCodes);
      setStep(3);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Codigo invalido.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleFinish = () => {
    setRequires2FASetup(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-heading-lg">Configurar 2FA</h1>
      </div>

      {isRequired && (
        <div className="rounded-button bg-warning/10 px-4 py-3 text-body-sm text-warning">
          Autenticacao em dois fatores e obrigatoria para administradores.
        </div>
      )}

      {/* Indicador de etapa */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-body-sm font-semibold ${
                step >= s
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-muted'
              }`}
            >
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-px w-8 ${step > s ? 'bg-primary' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-body-sm text-muted">
          {step === 1 && 'Escanear QR Code'}
          {step === 2 && 'Verificar codigo'}
          {step === 3 && 'Backup codes'}
        </span>
      </div>

      {/* Etapa 1: Gerar */}
      {step === 1 && (
        <Card className="p-6">
          <p className="mb-4 text-body-md text-muted">
            Use um app autenticador (Google Authenticator, Authy, 1Password) para
            escanear o QR code e gerar codigos de verificacao.
          </p>
          {error && (
            <div className="mb-4 rounded-button bg-danger/10 px-3 py-2 text-body-sm text-danger">
              {error}
            </div>
          )}
          <Button onClick={handleSetup} loading={loading}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Gerar QR Code
          </Button>
        </Card>
      )}

      {/* Etapa 2: QR + Verificar */}
      {step === 2 && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-body-md text-muted text-center">
              Escaneie este QR code com seu app autenticador:
            </p>
            {qrCode && (
              <div className="rounded-card bg-white p-3">
                <img src={qrCode} alt="QR Code 2FA" className="h-48 w-48" />
              </div>
            )}
            <div className="flex items-center gap-2 w-full">
              <code className="flex-1 rounded-button bg-white/5 px-3 py-2 text-body-sm font-mono text-muted break-all">
                {secret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                className="rounded-button p-2 text-muted hover:text-white hover:bg-white/10"
                title="Copiar chave"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              label="Codigo de verificacao"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoComplete="one-time-code"
              required
            />

            {error && (
              <div className="rounded-button bg-danger/10 px-3 py-2 text-body-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Verificar e ativar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* Etapa 3: Codigos de backup */}
      {step === 3 && (
        <Card className="p-6 space-y-6">
          <div className="rounded-button bg-success/10 px-4 py-3 text-body-sm text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            2FA ativado com sucesso!
          </div>

          <div>
            <h3 className="mb-2 font-heading text-heading-sm">Codigos de Backup</h3>
            <p className="mb-4 text-body-sm text-muted">
              Guarde estes codigos em um lugar seguro. Cada codigo pode ser usado uma unica vez
              caso voce perca acesso ao app autenticador.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((bc) => (
                <code
                  key={bc}
                  className="rounded-button bg-white/5 px-3 py-2 text-center text-body-sm font-mono text-white"
                >
                  {bc}
                </code>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyBackupCodes}
              className="flex items-center gap-2 text-body-sm text-primary hover:underline"
            >
              {copiedBackup ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar todos
                </>
              )}
            </button>
          </div>

          <Button onClick={handleFinish} className="w-full">
            Concluir
          </Button>
        </Card>
      )}
    </div>
  );
}
