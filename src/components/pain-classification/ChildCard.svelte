<script lang="ts">
  /**
   * One child assessment on the professional collection page: its heading,
   * "Take test" / "Edit the response" and "Download test" actions, the
   * manual-entry score fields, an optional bothersome-area field, and a
   * comment box. Pure view — the collection page owns and persists the values.
   */
  import OmrSheetButton from '../OmrSheetButton.svelte';
  import type { ChildAssessment } from '../../assessments/pain-classification/config';

  interface Props {
    child: ChildAssessment;
    number: number;
    complete: boolean;
    /** The child has per-question answers stored, so the test can be edited. */
    hasResponse: boolean;
    values: Record<string, number | undefined>;
    comment: string;
    area: string;
    onTakeTest: () => void;
    onField: (key: string, value: number) => void;
    onComment: (text: string) => void;
    onArea: (text: string) => void;
  }

  let {
    child,
    number,
    complete,
    hasResponse,
    values,
    comment,
    area,
    onTakeTest,
    onField,
    onComment,
    onArea,
  }: Props = $props();
</script>

<div class="card" class:card--done={complete}>
  <header class="card__header">
    <div class="card__lead">
      <span class="card__num" class:card__num--done={complete} aria-hidden="true">{number}</span>
      <div class="card__heading">
        <h2 class="card__title">{child.shortName}</h2>
        <p class="card__subtitle">{child.description}</p>
      </div>
    </div>
    <div class="card__actions">
      <button type="button" class="btn btn--success card__btn" onclick={onTakeTest}>
        {hasResponse ? 'Edit the response' : 'Take test'}
      </button>
      {#if child.omrTemplate}
        <OmrSheetButton template={child.omrTemplate} label="Download test" compact={true} />
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
          value={area}
          oninput={(e) => onArea(e.currentTarget.value)}
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
            value={values[f.key] ?? ''}
            oninput={(e) => onField(f.key, e.currentTarget.valueAsNumber)}
          />
        </label>
      {/each}

      <label class="field field--comment">
        <span class="field__label">Comments (optional)</span>
        <textarea
          class="field__textarea"
          rows="2"
          placeholder="Any notes about this assessment…"
          value={comment}
          oninput={(e) => onComment(e.currentTarget.value)}
        ></textarea>
      </label>
    </div>
  </div>
</div>

<style>
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
    color: var(--color-bg);
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

  /* Action button group — column so "Take the test" and "Download test" stack
     neatly at matching width. */
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
    color: var(--color-bg);
    white-space: nowrap;
  }
  .btn--success:hover {
    background: color-mix(in srgb, var(--color-success) 88%, black);
  }

  @media (max-width: 640px) {
    .card__header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
