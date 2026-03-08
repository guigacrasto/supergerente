import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import type { Tenant } from '@/types';

interface TenantWithCount extends Tenant {
  userCount?: number;
}

interface TenantFormProps {
  tenant: TenantWithCount | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TenantForm({ tenant, onClose, onSaved }: TenantFormProps) {
  const isEdit = !!tenant;

  const [name, setName] = useState(tenant?.name || '');
  const [slug, setSlug] = useState(tenant?.slug || '');
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor || '#9566F2');
  const [kommoBaseUrl, setKommoBaseUrl] = useState(tenant?.kommoBaseUrl || '');
  const [isActive, setIsActive] = useState(tenant?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !slug.trim()) {
      setError('Nome e slug são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        primaryColor,
        kommoBaseUrl: kommoBaseUrl.trim() || null,
        isActive,
      };

      if (isEdit) {
        await api.patch(`/super/tenants/${tenant.id}`, payload);
      } else {
        await api.post('/super/tenants', payload);
      }

      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar tenant.');
    } finally {
      setSaving(false);
    }
  };

  const autoSlug = (value: string) => {
    setName(value);
    if (!isEdit) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-glass-border bg-surface p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-heading-sm">
            {isEdit ? 'Editar Tenant' : 'Novo Tenant'}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-button p-1.5 text-muted hover:bg-surface-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-muted mb-1.5">Nome</label>
            <Input
              value={name}
              onChange={(e) => autoSlug(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-muted mb-1.5">Slug</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="nome-empresa"
            />
            <p className="mt-1 text-body-xs text-muted">Identificador único (letras, números e hífens)</p>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-muted mb-1.5">Cor Principal</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded-button border border-glass-border bg-surface-secondary cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#9566F2"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-muted mb-1.5">Kommo Base URL</label>
            <Input
              value={kommoBaseUrl}
              onChange={(e) => setKommoBaseUrl(e.target.value)}
              placeholder="https://empresa.kommo.com"
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="text-body-sm font-medium text-muted">Status</label>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ${
                  isActive ? 'bg-success' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    isActive ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-body-sm text-muted">{isActive ? 'Ativo' : 'Inativo'}</span>
            </div>
          )}

          {error && (
            <p className="text-body-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Tenant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
