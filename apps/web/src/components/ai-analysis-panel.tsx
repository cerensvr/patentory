'use client';

import type { Database, Json } from '@patent-knowledge/supabase/database.types';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type Run = Database['public']['Tables']['ai_analysis_runs']['Row'];
type Suggestion = Database['public']['Tables']['ai_analysis_suggestions']['Row'];
type PerformanceMetric = { name: string; value: string; unit: string | null; context: string; page: number | null };

type AnalysisResult = {
  independent_claims?: Array<{ claim_number: string; summary: string; evidence_quote: string; page: number | null }>;
  process_steps?: string[];
  performance_metrics?: PerformanceMetric[];
  examples?: Array<{ example_number: string; summary: string; chemicals: string[]; conditions: string[]; outcome: string; page: number | null }>;
  warnings?: string[];
};

const TYPE_LABELS: Record<string, string> = {
  CHEMICAL: 'Kimyasal',
  COMMERCIAL_PRODUCT: 'Ticari ürün',
  APPLICATION_CATEGORY: 'Uygulama kategorisi',
  TECHNICAL_PURPOSE: 'Teknik amaç',
};

export function AiAnalysisPanel({ patentId, hasPdf, initialRun, initialSuggestions }: {
  patentId: string;
  hasPdf: boolean;
  initialRun: Run | null;
  initialSuggestions: Suggestion[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const analysis = useMemo(() => asAnalysis(initialRun?.result_json), [initialRun?.result_json]);
  const processing = busy || initialRun?.status === 'QUEUED' || initialRun?.status === 'PROCESSING';

  useEffect(() => {
    if (!processing || busy) return;
    const timer = window.setInterval(() => router.refresh(), 4500);
    return () => window.clearInterval(timer);
  }, [busy, processing, router]);

  async function analyze() {
    setBusy(true);
    setError(undefined);
    setMessage('PDF yüksek ayrıntıyla inceleniyor. Bu işlem belgenin uzunluğuna göre birkaç dakika sürebilir.');
    const { data, error: invokeError } = await createClient().functions.invoke('analyze-patent', {
      body: { patentId },
    });
    setBusy(false);
    if (invokeError) {
      const context = await responseMessage(invokeError.context);
      setError(context ?? invokeError.message);
      setMessage(undefined);
      router.refresh();
      return;
    }
    if (data?.error) {
      setError(String(data.error));
      setMessage(undefined);
      return;
    }
    setMessage(data?.status === 'REVIEW_REQUIRED'
      ? 'Tarama tamamlandı. Bulguları doğrulayıp kütüphaneye ekleyebilirsiniz.'
      : 'Tarama tamamlandı.');
    router.refresh();
  }

  async function review(suggestion: Suggestion, decision: 'ACCEPTED' | 'REJECTED') {
    setReviewingId(suggestion.id);
    setError(undefined);
    const { data, error: reviewError } = await createClient().functions.invoke('review-ai-suggestion', {
      body: { suggestionId: suggestion.id, decision },
    });
    setReviewingId(undefined);
    if (reviewError || data?.error) setError(String(data?.error ?? reviewError?.message));
    else router.refresh();
  }

  return (
    <section className="ai-workbench">
      <div className="ai-heading">
        <div>
          <p className="eyebrow">KANITA DAYALI İNCELEME</p>
          <h2>AI patent taraması</h2>
          <p>PDF; istemler, kimyasallar, ticari ürünler, örnekler ve performans verileri için incelenir. Hiçbir öneri onayınız olmadan kütüphaneye eklenmez.</p>
        </div>
        <div className="ai-actions">
          <span className={`analysis-status status-${(initialRun?.status ?? 'NOT_ANALYZED').toLowerCase()}`}>
            {statusLabel(initialRun?.status)}
          </span>
          <button className="primary-action" disabled={!hasPdf || processing} onClick={analyze} type="button">
            {processing ? 'PDF inceleniyor…' : initialRun ? 'Yeniden tara' : 'AI taramasını başlat'}
          </button>
        </div>
      </div>

      {!hasPdf && <p className="form-message error">Tarama için bu kayda önce özel bir PDF yükleyin.</p>}
      {message && <p className="form-message success">{message}</p>}
      {error && <p className="form-message error">{error}</p>}
      {initialRun?.status === 'FAILED' && initialRun.error_message && (
        <p className="form-message error">Son tarama tamamlanamadı: {initialRun.error_message}</p>
      )}

      {initialRun?.executive_summary && (
        <div className="analysis-report">
          <ReportSection title="Yönetici özeti" text={initialRun.executive_summary} />
          <div className="analysis-columns">
            <ReportSection title="Teknik problem" text={initialRun.technical_problem} />
            <ReportSection title="Önerilen çözüm" text={initialRun.proposed_solution} />
          </div>
          <div className="analysis-columns three">
            <ReportList title="Yenilik noktaları" values={initialRun.novelty_points} />
            <ReportList title="Avantajlar" values={initialRun.advantages} />
            <ReportList title="Sınırlamalar / riskler" values={initialRun.limitations_and_risks} />
          </div>
          {!!analysis?.independent_claims?.length && (
            <details className="analysis-details">
              <summary>Bağımsız istemler <span>{analysis.independent_claims.length}</span></summary>
              <div>{analysis.independent_claims.map((claim) => (
                <article key={`${claim.claim_number}-${claim.page}`}>
                  <strong>İstem {claim.claim_number}</strong><p>{claim.summary}</p>
                  <Evidence quote={claim.evidence_quote} page={claim.page} />
                </article>
              ))}</div>
            </details>
          )}
          {!!analysis?.examples?.length && (
            <details className="analysis-details">
              <summary>Deneyler ve örnekler <span>{analysis.examples.length}</span></summary>
              <div>{analysis.examples.map((example) => (
                <article key={`${example.example_number}-${example.page}`}>
                  <strong>{example.example_number}</strong><p>{example.summary}</p>
                  {!!example.chemicals.length && <small>{example.chemicals.join(' · ')}</small>}
                  {!!example.conditions.length && <small>{example.conditions.join(' · ')}</small>}
                  <p>{example.outcome}</p>{example.page && <em>PDF s. {example.page}</em>}
                </article>
              ))}</div>
            </details>
          )}
          {!!analysis?.performance_metrics?.length && (
            <PerformanceCharts metrics={analysis.performance_metrics} />
          )}
        </div>
      )}

      {!!initialSuggestions.length && (
        <div className="suggestion-review">
          <div className="suggestion-title"><div><p className="eyebrow">İNSAN ONAYI</p><h3>Yapılandırılmış öneriler</h3></div><span>{initialSuggestions.filter((item) => item.review_status === 'PENDING').length} bekliyor</span></div>
          <div className="suggestion-grid">
            {initialSuggestions.map((suggestion) => {
              const canAccept = canAcceptSuggestion(suggestion);
              return (
                <article className={`suggestion-card review-${suggestion.review_status.toLowerCase()}`} key={suggestion.id}>
                  <div className="suggestion-meta"><span>{TYPE_LABELS[suggestion.suggestion_type] ?? suggestion.suggestion_type}</span><b>%{Math.round(Number(suggestion.confidence_score ?? 0) * 100)} güven</b></div>
                  <h4>{suggestion.label}</h4>
                  {suggestion.normalized_value && suggestion.normalized_value !== suggestion.label && <p className="normalized-value">Kanonik aday: {suggestion.normalized_value}</p>}
                  <Evidence quote={suggestion.evidence_quote} page={suggestion.evidence_page} />
                  {suggestion.review_status === 'PENDING' ? (
                    <div className="review-actions">
                      <button disabled={!canAccept || reviewingId === suggestion.id} onClick={() => review(suggestion, 'ACCEPTED')} type="button">Onayla ve ekle</button>
                      <button disabled={reviewingId === suggestion.id} onClick={() => review(suggestion, 'REJECTED')} type="button">Reddet</button>
                    </div>
                  ) : <p className="reviewed-label">{suggestion.review_status === 'ACCEPTED' ? 'Onaylandı ve işlendi' : 'Reddedildi'}</p>}
                  {!canAccept && suggestion.review_status === 'PENDING' && <small className="catalog-warning">Katalog eşleşmesi yok; önce katalog kaydı oluşturun veya öneriyi reddedin.</small>}
                </article>
              );
            })}
          </div>
        </div>
      )}

      <footer className="ai-disclaimer">AI çıktıları inceleme desteğidir; hukuki görüş değildir. Manuel kayıt ve filtreleme AI servisi kapalıyken de çalışır.</footer>
    </section>
  );
}

function ReportSection({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return <section className="report-section"><small>{title.toUpperCase()}</small><p>{text}</p></section>;
}

function ReportList({ title, values }: { title: string; values: string[] }) {
  return <section className="report-section"><small>{title.toUpperCase()}</small>{values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Belirgin bulgu yok.</p>}</section>;
}

function Evidence({ quote, page }: { quote: string | null; page: number | null }) {
  if (!quote && !page) return null;
  return <blockquote>{quote && <span>“{quote}”</span>}{page && <cite>PDF s. {page}</cite>}</blockquote>;
}

function PerformanceCharts({ metrics }: { metrics: PerformanceMetric[] }) {
  const numeric = metrics.flatMap((metric, index) => {
    const value = metricNumber(metric.value);
    return value === null ? [] : [{ ...metric, numericValue: value, key: `${metric.name}-${index}` }];
  });
  const maximumByUnit = new Map<string, number>();
  for (const metric of numeric) {
    const unit = metric.unit?.trim() || 'Sayısal değer';
    maximumByUnit.set(unit, Math.max(maximumByUnit.get(unit) ?? 0, Math.abs(metric.numericValue)));
  }

  return (
    <section className="performance-visual">
      <div className="performance-heading"><div><small>OTOMATİK GÖRSELLEŞTİRME</small><h3>Performans grafiği</h3></div><span>{numeric.length} sayısal ölçüm</span></div>
      {numeric.length > 0 && <div className="performance-bars">{numeric.map((metric) => {
        const unit = metric.unit?.trim() || 'Sayısal değer';
        const maximum = maximumByUnit.get(unit) || 1;
        const width = Math.max(3, Math.min(100, Math.abs(metric.numericValue) / maximum * 100));
        return <div className="performance-row" key={metric.key} title={metric.context}>
          <div><strong>{metric.name}</strong><span>{metric.value}{metric.unit ? ` ${metric.unit}` : ''}</span></div>
          <div className="performance-track"><i style={{ width: `${width}%` }} /></div>
          <small>{metric.context}{metric.page ? ` · PDF s. ${metric.page}` : ''}</small>
        </div>;
      })}</div>}
      {numeric.length === 0 && <p className="performance-empty">Karşılaştırılabilir sayısal değer bulunmadı; ölçümler aşağıda metin olarak korunuyor.</p>}
      <details className="analysis-details">
        <summary>Tüm performans ölçümleri <span>{metrics.length}</span></summary>
        <div>{metrics.map((metric, index) => (
          <article key={`${metric.name}-${index}`}><strong>{metric.name}</strong><b>{metric.value}{metric.unit ? ` ${metric.unit}` : ''}</b><p>{metric.context}</p>{metric.page && <em>PDF s. {metric.page}</em>}</article>
        ))}</div>
      </details>
    </section>
  );
}

function metricNumber(value: string) {
  const match = value.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function asAnalysis(value: Json | null | undefined): AnalysisResult | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnalysisResult : null;
}

function statusLabel(status?: string) {
  return ({
    QUEUED: 'Sırada', PROCESSING: 'İnceleniyor', REVIEW_REQUIRED: 'Onay bekliyor',
    COMPLETED: 'Tamamlandı', FAILED: 'Başarısız',
  } as Record<string, string>)[status ?? ''] ?? 'Henüz taranmadı';
}

function canAcceptSuggestion(item: Suggestion) {
  if (item.suggestion_type === 'APPLICATION_CATEGORY') return Boolean(item.matched_category_id);
  if (item.suggestion_type === 'TECHNICAL_PURPOSE') return Boolean(item.matched_purpose_id);
  return Boolean(item.matched_role_id);
}

async function responseMessage(context: unknown) {
  if (!(context instanceof Response)) return null;
  try {
    const body = await context.clone().json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}
