<script lang="ts">
  /**
   * Acute pain-classification collection page.
   *
   * One card per child assessment, laid out in three columns: the assessment
   * name, inline manual-entry inputs, and a "Fill Out Questionnaire" button
   * that opens the child's survey in a modal. Each card also has an optional
   * comment box; completing the questionnaire carries its comment over here.
   *
   * A child is "complete" once all its numeric fields hold finite values,
   * whether typed directly or populated by a finished questionnaire.
   * "Calculate Results" unlocks once every child is complete.
   *
   * Guards: if no role is stored, redirects back to the intake.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet, remove as storeRemove } from '../lib/storage';
  import MSISurvey from './MSISurvey.svelte';
  import BriefSLANSSSurvey from './BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from './FreBAQSurvey.svelte';
  import PHQ4Survey from './PHQ4Survey.svelte';
  import { readSheetFromBlob, grayImageToDataURL } from '../lib/omr/decode-image';
  import { readPdfFormFromBlob } from '../lib/omr/pdf-form-reader';
  import type { GrayImage } from '../lib/omr/types';
  import OmrSheetButton from './OmrSheetButton.svelte';
  import {
    ACUTE_CHILDREN,
    KEYS,
    type Role,
    type ChildAssessment,
  } from '../assessments/pain-classification/config';

  let loaded = $state(false);
  let role = $state<Role | null>(null);

  // Per-child working state: numeric field values + an optional comment.
  let values = $state<Record<string, Record<string, number | undefined>>>({});
  let comments = $state<Record<string, string>>({});
  // Free-text bothersome body region (FreBAQ only), surfaced on the card.
  let areas = $state<Record<string, string>>({});
  // The child whose questionnaire is currently open in the modal, if any.
  let modalChild = $state<ChildAssessment | null>(null);
  // Completion fraction (0–1) of the open questionnaire, bound from the
  // embedded survey so the modal header can render a fixed progress bar.
  let modalProgress = $state(0);

  // OMR upload state.
  let fileInput = $state<HTMLInputElement | undefined>(undefined);
  let pendingUploadChild: ChildAssessment | null = null;
  // Slug currently being read, so its button can show a busy label.
  let omrBusy = $state<string | null>(null);
  let omrError = $state<string | null>(null);
  // The scanned sheet awaiting the user's confirmation.
  let omrReview = $state<{
    child: ChildAssessment;
    /** The flattened scan to check answers against; null for a filled PDF,
     *  where the answers are exact and there is no image to show. */
    imageUrl: string | null;
    response: Record<string, number>;
    /** Pre-filled bothersome area (FreBAQ), from a filled PDF, OCR, or prior entry. */
    area?: string;
    /** Pre-filled comments, from a filled PDF, OCR, or prior entry. */
    comments?: string;
    /** Cropped handwriting regions (scan only) shown while OCR runs. */
    crops?: { key: string; label: string; kind: 'line' | 'box'; dataUrl: string; image: GrayImage; hasInk: boolean }[];
    /** True while handwriting recognition is still running on the crops. */
    ocrBusy?: boolean;
    /** The scanned area/comments regions had ink, so the reviewer must fill them. */
    requireArea?: boolean;
    requireComments?: boolean;
    /** The review is of a scanned sheet (open text fields are handwriting). */
    fromScan?: boolean;
    attention: string[];
  } | null>(null);

  onMount(() => {
    role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    // Seed working state from anything already saved.
    for (const child of ACUTE_CHILDREN) {
      const savedValues = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (savedValues) values[child.slug] = { ...savedValues };
      const savedComment = storeGet<string>(KEYS.commentPrefix + child.slug);
      if (savedComment) comments[child.slug] = savedComment;
      const savedResponse = storeGet<Record<string, unknown>>(child.slug + ':response');
      if (typeof savedResponse?.bothersome_area === 'string') areas[child.slug] = savedResponse.bothersome_area;
    }
    loaded = true;
  });

  function childComplete(child: ChildAssessment): boolean {
    const v = values[child.slug];
    return !!v && child.manualFields.every((f) => typeof v[f.key] === 'number' && Number.isFinite(v[f.key]));
  }

  const doneCount = $derived(ACUTE_CHILDREN.filter((c) => childComplete(c)).length);
  const allDone = $derived(doneCount === ACUTE_CHILDREN.length);

  /** Persist a child's values to storage, keeping only finite numbers. */
  function persistValues(slug: string): void {
    const v = values[slug] ?? {};
    const clean: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'number' && Number.isFinite(val)) clean[k] = val;
    }
    if (Object.keys(clean).length > 0) storeSet(KEYS.manualPrefix + slug, clean);
    else storeRemove(KEYS.manualPrefix + slug);
  }

  function setField(slug: string, key: string, raw: number): void {
    const value = Number.isFinite(raw) ? raw : undefined;
    values = { ...values, [slug]: { ...(values[slug] ?? {}), [key]: value } };
    persistValues(slug);
  }

  function setComment(slug: string, text: string): void {
    comments = { ...comments, [slug]: text };
    const trimmed = text.trim();
    if (trimmed) storeSet(KEYS.commentPrefix + slug, trimmed);
    else storeRemove(KEYS.commentPrefix + slug);
  }

  /**
   * Persist the free-text bothersome area typed on the card (FreBAQ only)
   * into the child's `${slug}:response`, the same place a completed
   * questionnaire or scanned sheet writes it — so it survives a reload and
   * pre-fills the questionnaire if opened.
   */
  function setArea(slug: string, text: string): void {
    areas = { ...areas, [slug]: text };
    const trimmed = text.trim();
    const response = storeGet<Record<string, unknown>>(slug + ':response') ?? {};
    if (trimmed) response.bothersome_area = trimmed;
    else delete response.bothersome_area;
    if (Object.keys(response).length > 0) storeSet(slug + ':response', response);
    else storeRemove(slug + ':response');
  }

  function openQuestionnaire(child: ChildAssessment): void {
    // Role-gated children (MSI) read their role from storage on mount, so it
    // must be set before the survey renders — otherwise the survey redirects.
    if (child.roleKey && role) storeSet(child.roleKey, role);
    modalProgress = 0;
    modalChild = child;
  }

  function closeQuestionnaire(): void {
    modalChild = null;
  }

  /**
   * Called by the embedded survey after it scores and persists its result.
   * Pull the computed field values into the inline inputs, and carry any
   * comment typed in the questionnaire over to the card's comment box.
   */
  function finishQuestionnaire(child: ChildAssessment): void {
    const extracted = child.fromResult(storeGet(child.resultKey));
    if (extracted) {
      values = { ...values, [child.slug]: { ...extracted } };
      persistValues(child.slug);
    }
    const response = storeGet<Record<string, unknown>>(child.slug + ':response');
    const comment = typeof response?.other_comments === 'string' ? response.other_comments : '';
    if (comment) setComment(child.slug, comment);
    if (typeof response?.bothersome_area === 'string' && response.bothersome_area) {
      areas = { ...areas, [child.slug]: response.bothersome_area };
    }
    modalChild = null;
  }

  /** Open the file picker to upload a scan/photo or filled PDF for a child. */
  function startUpload(child: ChildAssessment): void {
    if (!child.omrTemplate || !fileInput) return;
    omrError = null;
    pendingUploadChild = child;
    fileInput.value = ''; // allow re-selecting the same file
    fileInput.click();
  }

  /**
   * Read the chosen file, then open the confirmation review on success.
   * A PDF is a form filled on a computer — read its radio answers back
   * exactly; any other file is a scan/photo and goes through OMR.
   */
  async function onFileChosen(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    const child = pendingUploadChild;
    pendingUploadChild = null;
    if (!file || !child?.omrTemplate) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    omrError = null;
    omrBusy = child.slug;
    try {
      const result = isPdf
        ? await readPdfFormFromBlob(file, child.omrTemplate)
        : await readSheetFromBlob(file, child.omrTemplate);
      if (!result.ok) {
        omrError =
          (result.error ?? 'Could not read the file.') +
          (isPdf ? '' : ' Make sure the whole sheet is visible, well-lit, and reasonably flat.');
        return;
      }
      // A comment / bothersome area typed into the PDF flows into the same
      // places a questionnaire's would.
      if (isPdf && result.text?.other_comments) setComment(child.slug, result.text.other_comments);
      const pdfArea = isPdf && typeof result.text?.bothersome_area === 'string' ? result.text.bothersome_area : '';
      if (pdfArea) areas = { ...areas, [child.slug]: pdfArea };
      // Role-gated children (MSI) need their role set before the survey renders.
      if (child.roleKey && role) storeSet(child.roleKey, role);
      // A scan carries handwriting crops to recognize; a filled PDF carries
      // exact typed text and no crops.
      const crops =
        !isPdf && result.textCrops?.length
          ? result.textCrops.map((c) => ({
              key: c.key,
              label: c.label,
              kind: c.kind,
              dataUrl: grayImageToDataURL(c.image),
              image: c.image,
              hasInk: c.hasInk,
            }))
          : undefined;
      // Only recognize short single-line fields (the bothersome area) that
      // actually have ink. Multi-line boxes (comments) are slow and low-value
      // to OCR, so we skip them and require the reviewer to type them in.
      const ocrCrops = crops?.filter((c) => c.kind === 'line' && c.hasInk);
      omrReview = {
        child,
        imageUrl: result.warped ? grayImageToDataURL(result.warped) : null,
        response: result.response,
        area: pdfArea || areas[child.slug],
        comments: (isPdf ? result.text?.other_comments : undefined) ?? comments[child.slug],
        crops: ocrCrops?.length ? ocrCrops : undefined,
        ocrBusy: !!ocrCrops?.length,
        // A written-in region must be confirmed by the reviewer even if it
        // wasn't recognized.
        requireArea: crops?.some((c) => c.key === 'bothersome_area' && c.hasInk),
        requireComments: crops?.some((c) => c.key === 'other_comments' && c.hasInk),
        fromScan: !isPdf,
        attention: result.attention,
      };
      if (ocrCrops?.length) void runHandwritingOcr(ocrCrops);
    } catch (err) {
      omrError = err instanceof Error ? err.message : 'Could not read the file.';
    } finally {
      omrBusy = null;
    }
  }

  function closeReview(): void {
    omrReview = null;
  }

  /**
   * Recognize handwriting in each cropped region and pre-fill the matching
   * review field. Best-effort: unrecognized crops just leave the field blank
   * for manual entry. The survey renders once this finishes (or is skipped).
   */
  async function runHandwritingOcr(
    crops: { key: string; image: GrayImage }[],
  ): Promise<void> {
    const { recognizeHandwriting } = await import('../lib/omr/handwriting');
    for (const c of crops) {
      const text = await recognizeHandwriting(c.image);
      if (!omrReview) return; // review was closed mid-recognition
      if (text && c.key === 'bothersome_area') omrReview = { ...omrReview, area: text };
    }
    if (omrReview) omrReview = { ...omrReview, ocrBusy: false };
  }

  /** Stop waiting on recognition and confirm the answers manually. */
  function skipOcr(): void {
    if (omrReview) omrReview = { ...omrReview, ocrBusy: false };
  }

  /** The user confirmed the scanned answers via the embedded survey (which
   *  has already scored and persisted the result); fold it into the card. */
  function finishReview(child: ChildAssessment): void {
    finishQuestionnaire(child);
    omrReview = null;
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (omrError) omrError = null;
    else if (omrReview) closeReview();
    else if (modalChild) closeQuestionnaire();
  }

  function calculate(): void {
    if (!allDone) return;
    window.location.href = '/pain-classification/results/';
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if loaded}
  <section class="collect">
    <a class="collect__back" href="/pain-classification/">&larr; Go back</a>
    <h1 class="collect__heading">Acute Pain Classification</h1>
    <p class="collect__lede">
      Provide a result for each of the four assessments below — either enter a
      known result manually, or fill out the questionnaire. When all four are
      complete, calculate the composite classification.
    </p>

    <input
      bind:this={fileInput}
      type="file"
      accept="image/*,application/pdf"
      class="visually-hidden"
      onchange={onFileChosen}
    />

    <ul class="cards">
      {#each ACUTE_CHILDREN as child, i (child.slug)}
        <li class="assessment">
          <div class="card" class:card--done={childComplete(child)}>
            <header class="card__header">
              <div class="card__lead">
                <span class="card__num" class:card__num--done={childComplete(child)} aria-hidden="true">{i + 1}</span>
                <div class="card__heading">
                  <h2 class="card__title">{child.shortName}</h2>
                  <p class="card__subtitle">{child.title}</p>
                </div>
              </div>
              <div class="card__actions">
                <button type="button" class="btn btn--success card__btn" onclick={() => openQuestionnaire(child)}>
                  Take the test
                </button>
                {#if child.omrTemplate}
                  <button
                    type="button"
                    class="btn btn--secondary card__btn"
                    onclick={() => startUpload(child)}
                    disabled={omrBusy === child.slug}
                  >
                    {omrBusy === child.slug ? 'Reading…' : 'Upload scan, photo, or PDF'}
                  </button>
                  <OmrSheetButton template={child.omrTemplate} label="Download a copy" compact={true} />
                {/if}
              </div>
            </header>

            <div class="card__body">
            {#if child.areaField}
              <label class="field field--area">
                <span class="field__label">{child.areaField.label}</span>
                <input
                  class="field__input field__input--area"
                  type="text"
                  placeholder={child.areaField.placeholder}
                  value={areas[child.slug] ?? ''}
                  oninput={(e) => setArea(child.slug, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {/if}
            <div class="card__fields">
              {#each child.manualFields as f (f.key)}
                <label class="field">
                  <span class="field__label">
                    {f.label} <span class="field__range">({f.min}–{f.max})</span>
                  </span>
                  <input
                    class="field__input"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={values[child.slug]?.[f.key] ?? ''}
                    oninput={(e) => setField(child.slug, f.key, (e.currentTarget as HTMLInputElement).valueAsNumber)}
                  />
                </label>
              {/each}

              <label class="field field--comment">
                <span class="field__label">Comments (optional)</span>
                <textarea
                  class="field__textarea"
                  rows="2"
                  placeholder="Any notes about this assessment…"
                  value={comments[child.slug] ?? ''}
                  oninput={(e) => setComment(child.slug, (e.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
            </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    <div class="collect__footer">
      {#if !allDone}
        <p class="collect__hint">
          {ACUTE_CHILDREN.length - doneCount} of {ACUTE_CHILDREN.length} assessments still need a result.
        </p>
      {/if}
      <button type="button" class="btn btn--primary collect__calc" disabled={!allDone} onclick={calculate}>
        Calculate Results
      </button>
    </div>
  </section>

  {#if modalChild}
    {@const child = modalChild}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeQuestionnaire(); }}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label={`${child.shortName} questionnaire`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">{child.shortName}</h2>
              <p class="modal__subtitle">{child.title}</p>
            </div>
            <button type="button" class="modal__close" aria-label="Close questionnaire" onclick={closeQuestionnaire}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="modal__progress" aria-hidden="true">
            <div class="modal__progress-bar" style:width={`${Math.round(modalProgress * 100)}%`}></div>
          </div>
        </header>
        <div class="modal__body">
          {#if child.slug === 'msi'}
            <MSISurvey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'briefslanss'}
            <BriefSLANSSSurvey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'frebaq'}
            <FreBAQSurvey initialArea={areas[child.slug]} initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'phq4'}
            <PHQ4Survey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if omrReview}
    {@const rv = omrReview}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeReview(); }}
    >
      <div class="modal modal--review" role="dialog" aria-modal="true" aria-label={`Review ${rv.child.shortName}`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">Review {rv.imageUrl ? 'scanned' : 'filled'} {rv.child.shortName}</h2>
              <p class="modal__subtitle">
                {rv.imageUrl
                  ? 'We read your sheet — check the answers against the scan, correct any, then confirm.'
                  : 'We read your filled PDF — check the answers, correct any, then confirm.'}
              </p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" onclick={closeReview}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div class="modal__body review" class:review--noscan={!rv.imageUrl}>
          {#if rv.imageUrl}
            <div class="review__scan">
              <img class="review__img" src={rv.imageUrl} alt={`Flattened scan of the ${rv.child.shortName} answer sheet`} />
            </div>
          {/if}
          <div class="review__form">
            {#if rv.ocrBusy}
              <div class="ocr-panel">
                <p class="ocr-panel__status">
                  <span class="ocr-panel__spinner" aria-hidden="true"></span>
                  Reading handwriting… this can take a moment the first time.
                </p>
                {#each rv.crops ?? [] as c (c.key)}
                  <figure class="ocr-crop">
                    <figcaption class="ocr-crop__label">{c.label}</figcaption>
                    <img class="ocr-crop__img" src={c.dataUrl} alt={`Scanned ${c.label}`} />
                  </figure>
                {/each}
                <button type="button" class="btn btn--secondary" onclick={skipOcr}>
                  Skip and enter manually
                </button>
              </div>
            {:else}
            {#if rv.child.slug === 'msi'}
              <MSISurvey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                requireComments={rv.requireComments}
                highlightComments={rv.fromScan}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel="Confirm &amp; save"
                showProgress={false}
              />
            {:else if rv.child.slug === 'briefslanss'}
              <BriefSLANSSSurvey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                requireComments={rv.requireComments}
                highlightComments={rv.fromScan}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel="Confirm &amp; save"
                showProgress={false}
              />
            {:else if rv.child.slug === 'frebaq'}
              <FreBAQSurvey
                initialAnswers={rv.response}
                initialArea={rv.area}
                initialComments={rv.comments}
                requireArea={rv.requireArea}
                requireComments={rv.requireComments}
                highlightArea={rv.fromScan}
                highlightComments={rv.fromScan}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel="Confirm &amp; save"
                showProgress={false}
              />
            {:else if rv.child.slug === 'phq4'}
              <PHQ4Survey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                requireComments={rv.requireComments}
                highlightComments={rv.fromScan}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel="Confirm &amp; save"
                showProgress={false}
              />
            {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if omrError}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) omrError = null; }}
    >
      <div class="modal modal--narrow" role="alertdialog" aria-modal="true" aria-label="Scan could not be read">
        <div class="modal__body">
          <h2 class="modal__title">Couldn't read the sheet</h2>
          <p class="omr-error__text">{omrError}</p>
          <div class="omr-error__actions">
            <button type="button" class="btn btn--primary" onclick={() => omrError = null}>OK</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .collect__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    border-bottom: none;
  }

  .collect__heading {
    margin-bottom: var(--space-3);
  }

  .collect__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }

  .cards {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .card {
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    overflow: hidden; /* clip the header background to the rounded corners */
  }

  .card--done {
    border-color: var(--color-success);
  }

  /* Header band: assessment heading on the left, action button(s) on the
     right. White background, separated from the body by a bottom border. */
  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .card--done .card__header {
    border-bottom-color: var(--color-success);
  }

  /* Number badge + heading grouped on the left of the header band. */
  .card__lead {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  /* Numbered badge so each assessment reads as an ordered step. */
  .card__num {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--color-primary-tint-ghost);
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
  }

  .card__num--done {
    background: var(--color-success);
    color: #fff;
  }

  .card__heading {
    min-width: 0;
  }

  .card__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .card__subtitle {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: var(--space-1) 0 0 0;
  }

  /* Action button group — column so a second (e.g. "Upload image") button
     stacks neatly beneath the first at matching width. */
  .card__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .card__btn {
    padding: var(--space-2) var(--space-4);
    font-size: 0.85rem;
  }

  .card__body {
    padding: var(--space-5);
  }

  .field--area {
    margin-bottom: var(--space-4);
  }

  .field__input--area {
    width: 100%;
    max-width: 28rem;
  }

  .card__fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field--comment {
    width: 100%;
  }

  .field__label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .field__range {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .field__input {
    width: 8rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__input:focus,
  .field__textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .btn--success {
    background: var(--color-success);
    color: #fff;
    white-space: nowrap;
  }
  .btn--success:hover {
    filter: brightness(0.93);
  }

  @media (max-width: 640px) {
    .card__header {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .collect__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .collect__hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .collect__calc {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    background: rgba(0, 0, 0, 0.5);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 720px;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2 * var(--space-6));
  }

  .modal__head {
    padding: var(--space-5) var(--space-5) 0;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .modal__head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
  }

  /* Fixed progress track: lives in the sticky header, so its background
     stays put while the questionnaire body scrolls beneath it. */
  .modal__progress {
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: -1px; /* sit flush over the header's bottom border */
  }

  .modal__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .modal__title {
    margin: 0;
    font-size: 1.2rem;
  }

  .modal__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  .modal__close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .modal__close:hover {
    background: var(--color-primary-tint-ghost);
    color: var(--color-text);
  }

  .modal__body {
    padding: var(--space-5);
    overflow-y: auto;
  }

  /* Visually-hidden file input (kept in the DOM for programmatic click). */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Review modal: flattened scan beside the pre-filled survey. */
  .modal--review {
    max-width: 980px;
  }

  .review {
    display: flex;
    gap: var(--space-6);
    align-items: flex-start;
  }

  /* No scan to show (a filled PDF): center the form at a comfortable width
     rather than stretching it across the wide review modal. */
  .review--noscan {
    justify-content: center;
  }
  .review--noscan .review__form {
    max-width: 620px;
  }

  .review__scan {
    flex: 0 0 40%;
    position: sticky;
    top: 0;
    align-self: flex-start;
  }

  .review__img {
    width: 100%;
    height: auto;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: #fff;
  }

  .review__form {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Handwriting-recognition panel: shown while OCR runs on scanned crops. */
  .ocr-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .ocr-panel__status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text-muted);
  }

  .ocr-panel__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: ocr-spin 0.7s linear infinite;
  }

  @keyframes ocr-spin {
    to { transform: rotate(360deg); }
  }

  .ocr-crop {
    margin: 0;
    width: 100%;
  }

  .ocr-crop__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
  }

  .ocr-crop__img {
    max-width: 100%;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm, 4px);
    background: #fff;
  }

  .modal--narrow {
    max-width: 440px;
  }

  .omr-error__text {
    color: var(--color-text-muted);
    margin: var(--space-3) 0 var(--space-5) 0;
  }

  .omr-error__actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 720px) {
    .review {
      flex-direction: column;
    }
    .review__scan {
      position: static;
      flex-basis: auto;
      width: 100%;
      max-height: 40vh;
      overflow: auto;
    }
  }
</style>
