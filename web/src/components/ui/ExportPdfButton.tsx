import { useState, type RefObject } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportElementToPdf } from '@/lib/pdf-export';

interface ExportPdfButtonProps {
  targetRef: RefObject<HTMLDivElement | null>;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  className?: string;
}

export function ExportPdfButton({ targetRef, filename, orientation, className }: ExportPdfButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current || exporting) return;
    setExporting(true);
    try {
      await exportElementToPdf(targetRef.current, filename, { orientation });
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className={cn(
        'inline-flex items-center gap-2 rounded-button border border-glass-border bg-surface-secondary/60 px-3 py-2 text-body-sm font-medium text-muted transition-all duration-200 cursor-pointer',
        'hover:text-[#E0E3E9] hover:border-white/10 hover:bg-surface-secondary',
        'disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {exporting ? 'Exportando...' : 'Exportar PDF'}
    </button>
  );
}
