import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldOff, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, Input, Badge } from '@/components/ui';

interface TotpStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
}

export function TwoFactorSection() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Formulario de desativacao
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  // Codigos de backup
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenCode, setRegenCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get<TotpStatus>('/auth/2fa/status');
      setStatus(data);
    } catch {
      // Ignorar — usuario pode nao ter acesso
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDisabling(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword, code: disableCode });
      setSuccess('2FA desativado com sucesso.');
      setShowDisable(false);
      setDisablePassword('');
      setDisableCode('');
      fetchStatus();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao desativar 2FA.';
      setError(message);
    } finally {
      setDisabling(false);
    }
  };

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegenerating(true);
    try {
      const { data } = await api.post<{ backupCodes: string[] }>('/auth/2fa/backup-codes', { code: regenCode });
      setNewBackupCodes(data.backupCodes);
      setRegenCode('');
      setSuccess('Novos backup codes gerados.');
      fetchStatus();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Erro ao regenerar backup codes.';
      setError(message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    await navigator.clipboard.writeText(newBackupCodes.join('\n'));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  if (loading) return null;

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-heading-sm">Autenticacao em dois fatores</h2>
        </div>
        <Badge variant={status?.enabled ? 'success' : 'default'}>
          {status?.enabled ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {error && (
        <div className="mb-4 rounded-button bg-danger/10 px-3 py-2 text-body-sm text-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-button bg-success/10 px-3 py-2 text-body-sm text-success">
          {success}
        </div>
      )}

      {!status?.enabled ? (
        <div className="space-y-4">
          <p className="text-body-sm text-muted">
            Proteja sua conta com autenticacao em dois fatores usando um app autenticador
            (Google Authenticator, Authy).
          </p>
          {isAdmin && (
            <div className="rounded-button bg-warning/10 px-3 py-2 text-body-sm text-warning">
              Obrigatoria para administradores.
            </div>
          )}
          <Button onClick={() => navigate('/setup-2fa')}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Configurar 2FA
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {status.verifiedAt && (
            <p className="text-body-sm text-muted">
              Ativado em{' '}
              {new Date(status.verifiedAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <p className="text-body-sm text-muted">
            Backup codes restantes: <strong>{status.backupCodesRemaining}</strong>
          </p>

          {/* Regenerar codigos de backup */}
          {!showRegenerate ? (
            <Button
              variant="secondary"
              onClick={() => { setShowRegenerate(true); setNewBackupCodes([]); setError(''); setSuccess(''); }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerar backup codes
            </Button>
          ) : (
            <form onSubmit={handleRegenerate} className="space-y-3 rounded-card border border-white/10 p-4">
              <p className="text-body-sm text-muted">
                Os codigos antigos serao substituidos. Digite um codigo TOTP para confirmar.
              </p>
              <Input
                label="Codigo TOTP"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" loading={regenerating}>
                  Regenerar
                </Button>
                <Button variant="ghost" onClick={() => setShowRegenerate(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* Mostrar novos codigos de backup */}
          {newBackupCodes.length > 0 && (
            <div className="rounded-card border border-white/10 p-4 space-y-3">
              <h4 className="font-heading text-body-md">Novos Backup Codes</h4>
              <div className="grid grid-cols-2 gap-2">
                {newBackupCodes.map((bc) => (
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
                  <><CheckCircle className="h-4 w-4 text-success" /> Copiado!</>
                ) : (
                  <><Copy className="h-4 w-4" /> Copiar todos</>
                )}
              </button>
            </div>
          )}

          {/* Desativar 2FA (apenas para nao-admin) */}
          {!isAdmin && (
            <>
              {!showDisable ? (
                <Button
                  variant="secondary"
                  onClick={() => { setShowDisable(true); setError(''); setSuccess(''); }}
                  className="text-danger border-danger/30 hover:bg-danger/10"
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Desativar 2FA
                </Button>
              ) : (
                <form onSubmit={handleDisable} className="space-y-3 rounded-card border border-danger/30 p-4">
                  <p className="text-body-sm text-danger">
                    Isso remove a protecao extra da sua conta.
                  </p>
                  <Input
                    label="Senha"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Input
                    label="Codigo TOTP"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" loading={disabling} className="bg-danger hover:bg-danger/80">
                      Confirmar desativacao
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDisable(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          {isAdmin && (
            <p className="text-body-sm text-muted">
              Administradores nao podem desativar 2FA.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
