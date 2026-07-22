<script lang="ts">
  /**
   * Right-aligned "Assessment date" stamp for results pages.
   *
   * Shows the date the results are generated (i.e. when the assessment was
   * completed and viewed). Rendered client-side so it reflects the local date.
   */
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
</script>

<p class="assessment-date">
  <span class="assessment-date__label">Assessment date</span>
  <span class="assessment-date__value">{date}</span>
</p>

<style>
  .assessment-date {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    margin: 0;
    text-align: right;
  }

  .assessment-date__label {
    font-size: 0.8rem;
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .assessment-date__value {
    font-size: 0.95rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }
</style>
