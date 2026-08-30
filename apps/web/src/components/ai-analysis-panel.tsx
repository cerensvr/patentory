'use client';

import type { Database, Json } from '@patent-knowledge/supabase/database.types';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { createClient } from '@/lib/supabase/client';

type Run = Database['public']['Tables']['ai_analysis_runs']['Row'];
type Suggestion = Database['public']['Tables']['ai_analysis_suggestions']['Row'];
type PerformanceMetric = { name: string; value: string; unit: string | null; context: string; page: number | null };
type PatentExample = {
  example_number: string;
  summary: string;
  chemicals: string[];
  conditions: string[];
  composition?: Array<{ component: string; component_original?: string | null; amount: string | null; unit: string | null; unit_original?: string | null; basis: string | null; role: string | null; page: number | null }>;
  production_steps?: Array<{ step_number: string; instruction: string; conditions: string[]; page: number | null }>;
  test_results?: Array<{ test_name: string; method: string | null; result: string; unit: string | null; specimen: string | null; page: number | null }>;
  outcome: string;
  page: number | null;
};
type ComponentStandardization = { source_name: string; standardized_name: string; function: string; description: string; page: number | null };
type ExperimentalTable = {
  title: string;
  table_type: string;
  columns: Array<{ label: string; original_label: string | null; unit: string | null }>;
  rows: Array<{ row_label: string; cells: Array<string | null>; page: number | null }>;
  note: string | null;
};
type ExampleInventory = { declared_count: number | null; identifiers: string[]; source_pages: number[]; note: string };
type ExtractionAudit = { expected_count: number; captured_count: number; missing_identifiers: string[]; complete: boolean };

type AnalysisResult = {
  patent_metadata?: { abstract?: string | null };
  document_language?: string;
  independent_claims?: Array<{ claim_number: string; summary: string; evidence_quote: string; evidence_translation?: string; page: number | null }>;
  process_steps?: string[];
  performance_metrics?: PerformanceMetric[];
  component_standardizations?: ComponentStandardization[];
  example_inventory?: ExampleInventory;
  experimental_tables?: ExperimentalTable[];
  extraction_audit?: ExtractionAudit;
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
      setError(analysisErrorMessage(data));
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
                  <Evidence quote={claim.evidence_quote} translation={claim.evidence_translation} page={claim.page} />
                </article>
              ))}</div>
            </details>
          )}
          {(!!analysis?.examples?.length || !!analysis?.experimental_tables?.length || !!analysis?.component_standardizations?.length) && (
            <ExampleTables
              audit={analysis.extraction_audit}
              componentStandardizations={analysis.component_standardizations ?? []}
              examples={analysis.examples ?? []}
              experimentalTables={analysis.experimental_tables ?? []}
              inventory={analysis.example_inventory}
            />
          )}
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
              const displayLabel = suggestionDisplayLabel(suggestion);
              const catalogMatched = suggestionCatalogMatched(suggestion);
              return (
                <article className={`suggestion-card suggestion-type-${suggestion.suggestion_type.toLowerCase()} review-${suggestion.review_status.toLowerCase()}`} key={suggestion.id}>
                  <div className="suggestion-meta"><span>{TYPE_LABELS[suggestion.suggestion_type] ?? suggestion.suggestion_type}</span><b className={`confidence-${catalogMatched ? confidenceBand(confidence) : 'medium'}`}>{suggestionConfidenceLabel(suggestion, confidence)} · %{Math.round(confidence * 100)}</b></div>
                  <h4>{displayLabel}</h4>
                  {displayLabel !== suggestion.label && <p className="source-label">Kaynak/katalog adı: {suggestion.label}</p>}
                  {suggestion.normalized_value && suggestion.normalized_value !== suggestion.label && (
                    <p className="normalized-value">{suggestionCanonicalLabel(suggestion)}: {suggestion.normalized_value}</p>
                  )}
                  <Evidence quote={suggestion.evidence_quote} translation={suggestionPayloadText(suggestion, 'evidence_translation_tr')} page={suggestion.evidence_page} />
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
                  {!catalogMatched && suggestion.review_status === 'PENDING' && <small className="catalog-warning">Bu ad katalogda doğrulanmadı. Onaylarsanız yalnızca bu patente özgü ham malzeme olarak eklenir; ana kimyasal kataloğu değişmez.</small>}
                  {!canAccept && catalogMatched && suggestion.review_status === 'PENDING' && <small className="catalog-warning">Rol veya katalog eşleşmesi eksik; düzeltme bilgisini yazın ya da öneriyi reddedin.</small>}
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

function Evidence({ quote, translation, page }: { quote: string | null; translation?: string | null; page: number | null }) {
  if (!quote && !translation && !page) return null;
  return <blockquote>
    {translation && <span className="evidence-translation"><b>Türkçe</b>{translation}</span>}
    {quote && <details className="source-evidence"><summary>Özgün kaynak metni</summary><span>“{quote}”</span></details>}
    {page && <cite>PDF s. {page}</cite>}
  </blockquote>;
}

function ExampleTables({ audit, componentStandardizations, examples, experimentalTables, inventory }: {
  audit?: ExtractionAudit;
  componentStandardizations: ComponentStandardization[];
  examples: PatentExample[];
  experimentalTables: ExperimentalTable[];
  inventory?: ExampleInventory;
}) {
  const compositionRows = examples.flatMap((example) => (example.composition ?? []).map((row) => ({ example: example.example_number, ...row })));
  const productionRows = examples.flatMap((example) => (example.production_steps ?? []).map((row) => ({ example: example.example_number, ...row })));
  const testRows = examples.flatMap((example) => (example.test_results ?? []).map((row) => ({ example: example.example_number, ...row })));
  const tableTypes = new Set(experimentalTables.map((table) => table.table_type));
  const expectedCount = audit?.expected_count ?? inventory?.declared_count ?? inventory?.identifiers.length ?? examples.length;
  const capturedCount = audit?.captured_count ?? Math.max(examples.length, expectedCount);

  return (
    <section className="example-report">
      <div className="performance-heading"><div><small>YAPILANDIRILMIŞ DENEY RAPORU</small><h3>Örnek ve sonuç tabloları</h3></div><span>{expectedCount ? `${capturedCount}/${expectedCount} örnek` : `${examples.length} örnek`}</span></div>
      {audit && !audit.complete && (
        <p className="extraction-warning"><strong>Eksik tablo verisi algılandı.</strong> {capturedCount}/{expectedCount} örnek doğrulandı{audit.missing_identifiers.length ? `; eksik görünenler: ${audit.missing_identifiers.join(', ')}` : ''}. Kaynak PDF ile kontrol edip yeniden tarayın.</p>
      )}
      {inventory?.note && <p className="table-note">{inventory.note}</p>}
      {!!componentStandardizations.length && <AnalysisTable
        caption="Bileşenlerin Türkçe ve standart gösterimi"
        headers={['Patentteki özgün ad / kod', 'Türkçe / standart ad', 'İşlev', 'Açıklama', 'Sayfa']}
        rows={componentStandardizations.map((item) => [item.source_name, item.standardized_name, item.function || '—', item.description || '—', pageLabel(item.page)])}
      />}
      {experimentalTables.map((table, tableIndex) => {
        const includePage = table.rows.some((row) => row.page);
        return <div className="dynamic-analysis-table" key={`${table.table_type}-${table.title}-${tableIndex}`}>
          <AnalysisTable
            caption={table.title || tableTypeTitle(table.table_type)}
            headers={[tableRowHeader(table.table_type), ...table.columns.map((column) => `${column.label}${column.unit ? ` (${column.unit})` : ''}`), ...(includePage ? ['Sayfa'] : [])]}
            rows={table.rows.map((row) => [row.row_label, ...row.cells.map((cell) => cell ?? '—'), ...(includePage ? [pageLabel(row.page)] : [])])}
          />
          {table.note && <p className="table-note">{table.note}</p>}
        </div>;
      })}
      {!!examples.length && <AnalysisTable
        caption="Örnek özeti"
        headers={['Örnek', 'Türkçe özet', 'Koşullar', 'Sonuç', 'Sayfa']}
        rows={examples.map((example) => [
          example.example_number,
          example.summary,
          example.conditions?.join(' · ') || '—',
          example.outcome || '—',
          pageLabel(example.page),
        ])}
      />}
      {!!compositionRows.length && !tableTypes.has('EXAMPLE_COMPOSITION_MATRIX') && <AnalysisTable
        caption="İçerik / formülasyon tablosu"
        headers={['Örnek', 'Bileşen', 'Miktar', 'Baz', 'Rol', 'Sayfa']}
        rows={compositionRows.map((row) => [
          row.example,
          <TranslatedMaterial key={`${row.example}-${row.component}-${row.page ?? 'x'}`} translated={row.component} original={row.component_original} />,
          [row.amount, row.unit].filter(Boolean).join(' ') || '—',
          row.basis || '—',
          row.role || '—',
          pageLabel(row.page),
        ])}
      />}
      {!!productionRows.length && !tableTypes.has('PRODUCTION_PROCESS') && <AnalysisTable
        caption="Örneklerin üretim aşamaları"
        headers={['Örnek', 'Adım', 'Türkçe üretim talimatı', 'Koşullar', 'Sayfa']}
        rows={productionRows.map((row) => [row.example, row.step_number, row.instruction, row.conditions.join(' · ') || '—', pageLabel(row.page)])}
      />}
      {!!testRows.length && !tableTypes.has('TEST_RESULTS_MATRIX') && !tableTypes.has('CONDITION_RESULTS_MATRIX') && <AnalysisTable
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
      {!experimentalTables.length && !compositionRows.length && !productionRows.length && !testRows.length && (
        <p className="performance-empty">Bu analiz eski biçimde kaydedilmiş. Ayrıntılı içerik, üretim ve test tabloları için PDF’yi yeniden tarayın.</p>
      )}
    </section>
  );
}

function TranslatedMaterial({ translated, original }: { translated: string; original?: string | null }) {
  if (!original || original === translated) return translated;
  return <span className="translated-material"><strong>{translated}</strong><small>Özgün: {original}</small></span>;
}

function AnalysisTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
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

function tableTypeTitle(type: string) {
  return ({
    EXAMPLE_COMPOSITION_MATRIX: 'Örnek bileşimleri',
    PRODUCTION_PROCESS: 'Karıştırma, üretim ve kürleme prosesi',
    TEST_RESULTS_MATRIX: 'Örneklerin test sonuçları',
    CONDITION_RESULTS_MATRIX: 'Koşula bağlı test sonuçları',
  } as Record<string, string>)[type] ?? 'Patent deney tablosu';
}

function tableRowHeader(type: string) {
  if (type === 'PRODUCTION_PROCESS') return 'Adım';
  if (type === 'CONDITION_RESULTS_MATRIX') return 'Özellik / koşul';
  return 'Örnek';
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
  return ['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'rate_limit_exceeded', 'too_many_requests', 'RESOURCE_EXHAUSTED', '429'].includes(code ?? '');
}

function providerLabel(model?: string | null) {
  if (!model) return '—';
  if (model.startsWith('gemini:')) return `Gemini · ${model.slice(7)}`;
  if (model.startsWith('openai:')) return `OpenAI · ${model.slice(7)}`;
  return model;
}

const TURKISH_LABELS: Record<string, string> = {
  'epoxy foam': 'Epoksi köpük',
  'high adhesion': 'Yüksek yapışma',
  'potting': 'Elektronik dolgu / kapsülleme',
  'low density': 'Düşük yoğunluk',
  'low viscosity': 'Düşük viskozite',
  'low exotherm': 'Düşük ekzoterm',
  'fast cure': 'Hızlı kürlenme',
  'long pot life': 'Uzun çalışma süresi',
  'water resistance': 'Su direnci',
  'chemical resistance': 'Kimyasal direnç',
  'flame retardancy': 'Alev geciktiricilik',
  'high tg': 'Yüksek Tg',
};

function suggestionPayload(suggestion: Suggestion) {
  return suggestion.payload && typeof suggestion.payload === 'object' && !Array.isArray(suggestion.payload)
    ? suggestion.payload as Record<string, Json>
    : {};
}

function suggestionPayloadText(suggestion: Suggestion, key: string) {
  const value = suggestionPayload(suggestion)[key];
  return typeof value === 'string' ? value : null;
}

function suggestionDisplayLabel(suggestion: Suggestion) {
  const translated = suggestionPayloadText(suggestion, 'display_name_tr');
  if (translated) return translated;
  if (suggestion.suggestion_type === 'COMMERCIAL_PRODUCT') {
    const latin = suggestionPayloadText(suggestion, 'display_name_latin');
    if (latin) return latin;
  }
  return TURKISH_LABELS[suggestion.label.toLocaleLowerCase('en-US')] ?? suggestion.label;
}

function suggestionCatalogMatched(suggestion: Suggestion) {
  if (suggestion.suggestion_type === 'CHEMICAL') return Boolean(suggestion.matched_chemical_id);
  if (suggestion.suggestion_type === 'COMMERCIAL_PRODUCT') return Boolean(suggestion.matched_commercial_product_id);
  if (suggestion.suggestion_type === 'APPLICATION_CATEGORY') return Boolean(suggestion.matched_category_id);
  if (suggestion.suggestion_type === 'TECHNICAL_PURPOSE') return Boolean(suggestion.matched_purpose_id);
  return false;
}

function suggestionConfidenceLabel(suggestion: Suggestion, confidence: number) {
  if (!suggestionCatalogMatched(suggestion) && ['CHEMICAL', 'COMMERCIAL_PRODUCT'].includes(suggestion.suggestion_type)) {
    return confidence >= .85 ? 'Metinde açık · ad doğrulanmalı' : 'Doğrulama gerekli';
  }
  return confidenceLabel(confidence);
}

function suggestionCanonicalLabel(suggestion: Suggestion) {
  return suggestionCatalogMatched(suggestion) ? 'Katalog eşleşmesi' : 'Standart ad önerisi (doğrulanmadı)';
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
    return analysisErrorMessage(body);
  } catch {
    return null;
  }
}

function analysisErrorMessage(body: unknown) {
  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const code = typeof payload.code === 'string' ? payload.code : '';
  const messages: Record<string, string> = {
    too_many_requests: 'Gemini geçici istek sınırına ulaştı. Yedek model de aynı Google proje kotasını kullanıyorsa tarama başlayamaz; birkaç dakika sonra yeniden deneyin.',
    RESOURCE_EXHAUSTED: 'Gemini’nin dakikalık veya günlük kotası doldu. Kota yenilendiğinde yeniden deneyin.',
    '429': 'Gemini’nin dakikalık veya günlük kotası doldu. Kota yenilendiğinde yeniden deneyin.',
    DEADLINE_EXCEEDED: 'PDF analizi zaman aşımına uğradı. Biraz sonra yeniden deneyin.',
    request_timeout: 'PDF analizi zaman aşımına uğradı. Biraz sonra yeniden deneyin.',
    API_KEY_INVALID: 'Gemini bağlantısı yapılandırılamadı. Servis anahtarının yönetici tarafından kontrol edilmesi gerekiyor.',
    invalid_api_key: 'AI bağlantısı yapılandırılamadı. Servis anahtarının yönetici tarafından kontrol edilmesi gerekiyor.',
  };
  if (messages[code]) return messages[code];
  return typeof payload.error === 'string'
    ? payload.error
    : 'Patent analizi tamamlanamadı. Biraz sonra yeniden deneyin.';
}
