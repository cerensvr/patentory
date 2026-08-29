'use client';

import type { Database, Json } from '@patent-knowledge/supabase/database.types';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type Run = Database['public']['Tables']['ai_analysis_runs']['Row'];
type Suggestion = Database['public']['Tables']['ai_analysis_suggestions']['Row'];
type PerformanceMetric = { name: string; value: string; unit: string | null; context: string; page: number | null };
type PatentExample = {
  example_number: string;
  summary: string;
  chemicals: string[];
  conditions: string[];
  composition?: Array<{ component: string; amount: string | null; unit: string | null; basis: string | null; role: string | null; page: number | null }>;
  production_steps?: Array<{ step_number: string; instruction: string; conditions: string[]; page: number | null }>;
  test_results?: Array<{ test_name: string; method: string | null; result: string; unit: string | null; specimen: string | null; page: number | null }>;
  outcome: string;
  page: number | null;
};

type AnalysisResult = {
  patent_metadata?: { abstract?: string | null };
  document_language?: string;
  independent_claims?: Array<{ claim_number: string; summary: string; evidence_quote: string; page: number | null }>;
  process_steps?: string[];
  performance_metrics?: PerformanceMetric[];
  examples?: PatentExample[];
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
  const [correctingId, setCorrectingId] = useState<string>();
  const [correctionText, setCorrectionText] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [allowGeminiFallback, setAllowGeminiFallback] = useState(true);
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
      body: { patentId, preferGemini: true, allowGeminiFallback, allowOpenAiFallback: false },
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
    const provider = data?.provider === 'gemini' ? 'Gemini' : 'OpenAI';
    setMessage(data?.status === 'REVIEW_REQUIRED'
      ? `${provider} ile tarama tamamlandı. Bulguları doğrulayıp kütüphaneye ekleyebilirsiniz.`
      : `${provider} ile tarama tamamlandı.`);
    router.refresh();
  }

  async function review(suggestion: Suggestion, decision: 'ACCEPTED' | 'REJECTED', correction?: string) {
    setReviewingId(suggestion.id);
    setError(undefined);
    const { data, error: reviewError } = await createClient().functions.invoke('review-ai-suggestion', {
      body: { suggestionId: suggestion.id, decision, correction: correction?.trim() || undefined },
    });
    setReviewingId(undefined);
    if (reviewError || data?.error) setError(String(data?.error ?? reviewError?.message));
    else {
      setCorrectingId(undefined);
      setCorrectionText('');
      setMessage(decision === 'ACCEPTED'
        ? 'Onayınız kaydedildi; benzer ifadeler sonraki taramalarda daha doğru eşleştirilecek.'
        : correction?.trim()
          ? `“${suggestion.label}” için düzeltmeniz öğrenildi.`
          : 'Öneri yanlış olarak kaydedildi ve sonraki taramalarda dikkate alınacak.');
      router.refresh();
    }
  }

  function askForCorrection(suggestionId: string) {
    setCorrectingId(suggestionId);
    setCorrectionText('');
    setError(undefined);
  }

  return (
    <section className="ai-workbench">
      <div className="ai-heading">
        <div>
          <p className="eyebrow">AKILLI DOKÜMAN ANALİZİ</p>
          <h2>Patent taraması</h2>
          <p>PDF; istemler, kimyasallar, ticari ürünler, örnekler ve performans verileri için incelenir. Hiçbir öneri onayınız olmadan kütüphaneye eklenmez.</p>
        </div>
        <div className="ai-actions">
          <span className={`analysis-status status-${(initialRun?.status ?? 'NOT_ANALYZED').toLowerCase()}`}>
            {statusLabel(initialRun?.status, initialRun?.error_code)}
          </span>
          <button className="primary-action" disabled={!hasPdf || processing} onClick={analyze} type="button">
            {processing ? 'PDF inceleniyor…' : initialRun ? 'Yeniden tara' : 'Patent taramasını başlat'}
          </button>
        </div>
      </div>

      <label className="ai-fallback-option">
        <input checked={allowGeminiFallback} disabled={processing} onChange={(event) => setAllowGeminiFallback(event.target.checked)} type="checkbox" />
        <span><strong>Gemini 3.7 kotası dolarsa Flash‑Lite ile devam et</strong><small>3.7 Flash günlük 20 güçlü tarama sağlar; Flash‑Lite yedeği günlük 500 ek tarama sunar. Ücretsiz Gemini’ye gönderilen yayımlanmış patent içeriği Google tarafından ürün geliştirmede kullanılabilir.</small></span>
      </label>

      {!hasPdf && <p className="form-message error">Tarama için bu kayda önce özel bir PDF yükleyin.</p>}
      {message && <p className="form-message success">{message}</p>}
      {error && <p className="form-message error">{error}</p>}
      {!error && initialRun?.status === 'FAILED' && initialRun.error_message && (
        <p className="form-message error">Son tarama tamamlanamadı: {initialRun.error_message} <a href="#manual-patent-editor">Bilgileri manuel düzenleyin.</a></p>
      )}

      {initialRun?.executive_summary && (
        <div className="analysis-report">
          <div className="analysis-quality">
            <QualityMetric label="Kanıtlı öneri" value={String(initialSuggestions.length)} />
            <QualityMetric label="Yüksek güven" value={String(initialSuggestions.filter((item) => Number(item.confidence_score ?? 0) >= .85).length)} />
            <QualityMetric label="Belge dili" value={analysis?.document_language || '—'} />
            <QualityMetric label="Uyarı" value={String(analysis?.warnings?.length ?? 0)} />
            <QualityMetric label="Kullanılan model" value={providerLabel(initialRun.model)} />
            <QualityMetric label="Ücretli karşılığı" value={estimatedPaidCostTry(initialRun)} />
          </div>
          <ReportSection title="Yönetici özeti" text={initialRun.executive_summary} />
          <ReportSection title="Türkçe abstract" text={analysis?.patent_metadata?.abstract ?? null} />
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
          {!!analysis?.examples?.length && <ExampleTables examples={analysis.examples} />}
          {!!analysis?.process_steps?.length && (
            <details className="analysis-details">
              <summary>Proses adımları <span>{analysis.process_steps.length}</span></summary>
              <div>{analysis.process_steps.map((step, index) => <article key={`${index}-${step}`}><strong>{index + 1}. adım</strong><p>{step}</p></article>)}</div>
            </details>
          )}
          {!!analysis?.performance_metrics?.length && (
            <PerformanceCharts metrics={analysis.performance_metrics} />
          )}
          {!!analysis?.warnings?.length && <ReportList title="Analiz uyarıları" values={analysis.warnings} />}
        </div>
      )}

      {!!initialSuggestions.length && (
        <div className="suggestion-review">
          <div className="suggestion-title"><div><p className="eyebrow">BULGULARI DOĞRULA</p><h3>Yapılandırılmış öneriler</h3></div><span>{initialSuggestions.filter((item) => item.review_status === 'PENDING').length} bekliyor</span></div>
          <div className="suggestion-grid">
            {initialSuggestions.map((suggestion) => {
              const canAccept = canAcceptSuggestion(suggestion);
              const confidence = Number(suggestion.confidence_score ?? 0);
              return (
                <article className={`suggestion-card review-${suggestion.review_status.toLowerCase()}`} key={suggestion.id}>
                  <div className="suggestion-meta"><span>{TYPE_LABELS[suggestion.suggestion_type] ?? suggestion.suggestion_type}</span><b className={`confidence-${confidenceBand(confidence)}`}>{confidenceLabel(confidence)} · %{Math.round(confidence * 100)}</b></div>
                  <h4>{suggestion.label}</h4>
                  {suggestion.normalized_value && suggestion.normalized_value !== suggestion.label && <p className="normalized-value">Kanonik aday: {suggestion.normalized_value}</p>}
                  <Evidence quote={suggestion.evidence_quote} page={suggestion.evidence_page} />
                  {suggestion.review_status === 'PENDING' ? (
                    <>
                      <div className="review-actions">
                        <button disabled={!canAccept || reviewingId === suggestion.id} onClick={() => review(suggestion, 'ACCEPTED')} type="button">Onayla ve ekle</button>
                        <button disabled={reviewingId === suggestion.id} onClick={() => askForCorrection(suggestion.id)} type="button">Yanlış / düzelt</button>
                      </div>
                      {correctingId === suggestion.id && (
                        <div className="learning-correction">
                          <label htmlFor={`correction-${suggestion.id}`}>Bu ifade neyi anlatıyor?</label>
                          <input
                            autoFocus
                            id={`correction-${suggestion.id}`}
                            maxLength={500}
                            onChange={(event) => setCorrectionText(event.target.value)}
                            placeholder="Doğru kimyasal, ticari ürün, kategori veya teknik amacı yazın"
                            value={correctionText}
                          />
                          <small>Düzeltmeniz yalnızca size ait öğrenme hafızasına kaydedilir; kimyasal kataloğu değiştirmez.</small>
                          <div>
                            <button disabled={!correctionText.trim() || reviewingId === suggestion.id} onClick={() => review(suggestion, 'REJECTED', correctionText)} type="button">Düzeltmeyi öğret</button>
                            <button disabled={reviewingId === suggestion.id} onClick={() => review(suggestion, 'REJECTED')} type="button">Sadece yanlış</button>
                            <button disabled={reviewingId === suggestion.id} onClick={() => { setCorrectingId(undefined); setCorrectionText(''); }} type="button">Vazgeç</button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : <p className="reviewed-label">{suggestion.review_status === 'ACCEPTED' ? 'Onaylandı ve işlendi' : 'Reddedildi'}</p>}
                  {!canAccept && suggestion.review_status === 'PENDING' && <small className="catalog-warning">Katalog eşleşmesi yok; önce katalog kaydı oluşturun veya öneriyi reddedin.</small>}
                </article>
              );
            })}
          </div>
        </div>
      )}

      <footer className="ai-disclaimer">Analiz sonuçlarını kütüphaneye işlemeden önce kaynak sayfasıyla doğrulayın.</footer>
    </section>
  );
}

function ReportSection({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return <section className="report-section"><small>{title.toUpperCase()}</small><p>{text}</p></section>;
}

function QualityMetric({ label, value }: { label: string; value: string }) {
  return <div><small>{label.toUpperCase()}</small><strong>{value}</strong></div>;
}

function ReportList({ title, values }: { title: string; values: string[] }) {
  return <section className="report-section"><small>{title.toUpperCase()}</small>{values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Belirgin bulgu yok.</p>}</section>;
}

function Evidence({ quote, page }: { quote: string | null; page: number | null }) {
  if (!quote && !page) return null;
  return <blockquote>{quote && <span>“{quote}”</span>}{page && <cite>PDF s. {page}</cite>}</blockquote>;
}

function ExampleTables({ examples }: { examples: PatentExample[] }) {
  const compositionRows = examples.flatMap((example) => (example.composition ?? []).map((row) => ({ example: example.example_number, ...row })));
  const productionRows = examples.flatMap((example) => (example.production_steps ?? []).map((row) => ({ example: example.example_number, ...row })));
  const testRows = examples.flatMap((example) => (example.test_results ?? []).map((row) => ({ example: example.example_number, ...row })));

  return (
    <section className="example-report">
      <div className="performance-heading"><div><small>YAPILANDIRILMIŞ DENEY RAPORU</small><h3>Örnek ve sonuç tabloları</h3></div><span>{examples.length} örnek</span></div>
      <AnalysisTable
        caption="Örnek özeti"
        headers={['Örnek', 'Türkçe özet', 'Koşullar', 'Sonuç', 'Sayfa']}
        rows={examples.map((example) => [
          example.example_number,
          example.summary,
          example.conditions?.join(' · ') || '—',
          example.outcome || '—',
          pageLabel(example.page),
        ])}
      />
      {!!compositionRows.length && <AnalysisTable
        caption="İçerik / formülasyon tablosu"
        headers={['Örnek', 'Bileşen', 'Miktar', 'Baz', 'Rol', 'Sayfa']}
        rows={compositionRows.map((row) => [
          row.example,
          row.component,
          [row.amount, row.unit].filter(Boolean).join(' ') || '—',
          row.basis || '—',
          row.role || '—',
          pageLabel(row.page),
        ])}
      />}
      {!!productionRows.length && <AnalysisTable
        caption="Örneklerin üretim aşamaları"
        headers={['Örnek', 'Adım', 'Türkçe üretim talimatı', 'Koşullar', 'Sayfa']}
        rows={productionRows.map((row) => [row.example, row.step_number, row.instruction, row.conditions.join(' · ') || '—', pageLabel(row.page)])}
      />}
      {!!testRows.length && <AnalysisTable
        caption="Test sonuçları"
        headers={['Örnek', 'Test / metot', 'Sonuç', 'Numune', 'Sayfa']}
        rows={testRows.map((row) => [
          row.example,
          [row.test_name, row.method].filter(Boolean).join(' · '),
          `${row.result}${row.unit ? ` ${row.unit}` : ''}`,
          row.specimen || '—',
          pageLabel(row.page),
        ])}
      />}
      {!compositionRows.length && !productionRows.length && !testRows.length && (
        <p className="performance-empty">Bu analiz eski biçimde kaydedilmiş. Ayrıntılı içerik, üretim ve test tabloları için PDF’yi yeniden tarayın.</p>
      )}
    </section>
  );
}

function AnalysisTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="analysis-table-block">
      <h4>{caption}<span>{rows.length} satır</span></h4>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={`${caption}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function pageLabel(page: number | null) {
  return page ? `PDF s. ${page}` : '—';
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

function statusLabel(status?: string, errorCode?: string | null) {
  if (status === 'FAILED' && isQuotaCode(errorCode)) return 'Kota doldu';
  return ({
    QUEUED: 'Sırada', PROCESSING: 'İnceleniyor', REVIEW_REQUIRED: 'Onay bekliyor',
    COMPLETED: 'Tamamlandı', FAILED: 'Başarısız',
  } as Record<string, string>)[status ?? ''] ?? 'Henüz taranmadı';
}

function isQuotaCode(code?: string | null) {
  return ['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'rate_limit_exceeded', 'RESOURCE_EXHAUSTED', '429'].includes(code ?? '');
}

function providerLabel(model?: string | null) {
  if (!model) return '—';
  if (model.startsWith('gemini:')) return `Gemini · ${model.slice(7)}`;
  if (model.startsWith('openai:')) return `OpenAI · ${model.slice(7)}`;
  return model;
}

function estimatedPaidCostTry(run: Run) {
  const input = run.input_tokens ?? 0;
  const output = run.output_tokens ?? 0;
  if (!input && !output) return '—';
  const model = run.model ?? '';
  const prices = model.includes('gemini-3.7-flash') ? [.75, 3.75]
    : model.includes('gemini-3.5-flash-lite') ? [.30, 2.50]
    : model.includes('gpt-5.6-luna') ? [.20, 1.20]
    : model.includes('gpt-5.6-terra') ? [2, 12]
    : model.includes('gpt-5.6') ? [4, 20]
    : null;
  if (!prices) return '—';
  const usd = (input * prices[0] + output * prices[1]) / 1_000_000;
  return `≈ ₺${(usd * 48.16).toFixed(2)}`;
}

function canAcceptSuggestion(item: Suggestion) {
  if (item.suggestion_type === 'APPLICATION_CATEGORY') return Boolean(item.matched_category_id);
  if (item.suggestion_type === 'TECHNICAL_PURPOSE') return Boolean(item.matched_purpose_id);
  return Boolean(item.matched_role_id);
}

function confidenceBand(value: number) {
  return value >= .85 ? 'high' : value >= .7 ? 'medium' : 'low';
}

function confidenceLabel(value: number) {
  return value >= .85 ? 'Yüksek güven' : value >= .7 ? 'Orta güven' : 'Kontrol gerekli';
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
