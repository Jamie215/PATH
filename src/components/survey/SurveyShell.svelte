<script lang="ts">
  /**
   * Frame shared by every survey form: the progress bar, the intro, the
   * question list (supplied by the survey), the comments box, and the
   * back / submit row. The survey owns its answers, validation and scoring;
   * the shell owns only layout and the comments text (bindable).
   */
  import type { Snippet } from 'svelte';
  import BackLink from '../BackLink.svelte';

  interface Props {
    intro: string;
    /** Completion fraction (0–1) for the inline progress bar. */
    progress: number;
    showProgress?: boolean;
    comments: string;
    commentsDetected?: boolean;
    /** Show the comments + submit row (a survey may gate them, e.g. FreBAQ
     *  until an area is confirmed). */
    showFooter?: boolean;
    /** Questions still unanswered; shown as a hint after a submit attempt. */
    missingCount: number;
    submitAttempted: boolean;
    submitLabel: string;
    submitIcon?: string;
    onBack?: () => void;
    backLabel?: string;
    onSubmit: () => void;
    /** Content between the intro and the questions (e.g. the area field). */
    header?: Snippet;
    /** The question list. */
    children: Snippet;
  }

  let {
    intro,
    progress,
    showProgress = true,
    comments = $bindable(),
    commentsDetected = false,
    showFooter = true,
    missingCount,
    submitAttempted,
    submitLabel,
    submitIcon,
    onBack,
    backLabel = 'Back',
    onSubmit,
    header,
    children,
  }: Props = $props();

  const commentsId = $props.id();

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    onSubmit();
  }
</script>

<form class="survey" onsubmit={handleSubmit} novalidate>
  {#if showProgress}
    <div class="survey__progress" aria-hidden="true">
      <div class="survey__progress-bar" style:width={`${Math.round(progress * 100)}%`}></div>
    </div>
  {/if}

  <p class="survey__intro">{intro}</p>

  {@render header?.()}

  {@render children()}

  {#if showFooter}
    <div class="comments">
      <label for={commentsId} class="comments__label">
        If there is anything you would like to say about these or any other symptoms, please enter below.
      </label>
      <textarea
        id={commentsId}
        class="comments__input"
        class:field--flagged={commentsDetected}
        rows="4"
        bind:value={comments}
        placeholder={commentsDetected ? 'A comment was detected on the scan — transcribe it here if relevant' : 'Optional'}
      ></textarea>
      {#if commentsDetected}
        <p class="field__hint">A comment was detected on the scanned sheet — transcribe it here if relevant (optional).</p>
      {/if}
    </div>

    <div class="actions">
      {#if onBack}
        <div class="actions__back">
          <BackLink {onBack} label={backLabel} variant="button" />
        </div>
      {/if}
      {#if submitAttempted && missingCount > 0}
        <p class="actions__hint" role="alert">
          {missingCount} question{missingCount === 1 ? '' : 's'} still to answer.
        </p>
      {/if}
      <button type="submit" class="btn btn--next actions__submit">
        {submitLabel}
        {#if submitIcon}
          <span class="material-symbols-outlined" aria-hidden="true">{submitIcon}</span>
        {/if}
      </button>
    </div>
  {/if}
</form>

<style>
  .survey__progress {
    position: sticky;
    top: 0;
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: var(--space-6);
    z-index: 10;
  }

  .survey__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .survey__intro {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
    font-size: 0.95rem;
  }

  .comments {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .comments__label {
    display: block;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: var(--space-3);
  }

  .comments__input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .comments__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: stretch;
    gap: var(--space-3);
  }

  /* Push the back control to the left so the submit button stays right-aligned. */
  .actions__back {
    margin-right: auto;
    align-self: center;
  }

  .actions__hint {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: 0;
    align-self: center;
    text-align: center;
  }

  .actions__submit {
    align-self: center;
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }
</style>
