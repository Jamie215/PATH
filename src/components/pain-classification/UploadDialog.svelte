<script lang="ts">
  /** Drag-and-drop / browse target for a completed-tests upload. */
  import Modal from '../Modal.svelte';
  import type { UploadFlow } from './upload-flow.svelte';

  let { flow }: { flow: UploadFlow } = $props();
  let dragActive = $state(false);

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    dragActive = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) void flow.ingest(files);
  }

  function onChosen(e: Event & { currentTarget: HTMLInputElement }): void {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = '';
    if (files.length) void flow.ingest(files);
  }
</script>

<Modal
  title="Upload completed tests"
  subtitle="What the patient filled out and shared: the on-screen PDFs, a scan of the printed sheets, or photos of them. It can be all or just the tests they completed."
  size="narrow"
  onClose={flow.closeUpload}
>
  <label
    class="dropzone"
    class:dropzone--active={dragActive}
    class:dropzone--busy={flow.busy}
    ondragover={(e) => { e.preventDefault(); if (!flow.busy) dragActive = true; }}
    ondragleave={(e) => { e.preventDefault(); dragActive = false; }}
    ondrop={onDrop}
  >
    <input
      type="file"
      accept="image/*,application/pdf"
      multiple
      class="visually-hidden"
      onchange={onChosen}
      disabled={flow.busy}
    />
    <span class="material-symbols-outlined dropzone__icon" aria-hidden="true">
      {flow.busy ? 'hourglass_top' : 'upload_file'}
    </span>
    {#if flow.busy}
      <span class="dropzone__text" role="status">Reading…</span>
    {:else}
      <span class="dropzone__text"><strong>Drag files here</strong>, or click to browse</span>
      <span class="dropzone__hint">PDF, or one photo/scan per sheet</span>
    {/if}
  </label>
  {#if flow.error}
    <p class="dropzone__error" role="alert">{flow.error}</p>
  {/if}
</Modal>

<style>
  /* Upload modal: drag-and-drop / click-to-browse target. The whole zone is a
     <label> wrapping a hidden file input, so a click anywhere opens the
     picker while drop events are handled directly. */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-7) var(--space-4);
    text-align: center;
    border: 2px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-alt);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .dropzone:hover,
  .dropzone:focus-within {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
  }

  .dropzone--active {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-soft);
  }

  .dropzone--busy {
    cursor: progress;
    opacity: 0.75;
  }

  .dropzone__icon {
    font-size: 2rem;
    color: var(--color-primary);
  }

  .dropzone__text {
    font-size: 0.95rem;
  }

  .dropzone__hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .dropzone__error {
    margin: var(--space-3) 0 0 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
    border-radius: var(--radius-md);
  }
</style>
