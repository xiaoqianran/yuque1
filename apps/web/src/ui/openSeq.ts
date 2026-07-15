/**
 * Request sequence gate for async document open.
 * Used by useDocumentSelection so stale contentApi responses cannot overwrite
 * a newer selection.
 */
export class OpenSequence {
  private seq = 0;

  /** Start a new open; returns the sequence id for this attempt. */
  next(): number {
    this.seq += 1;
    return this.seq;
  }

  /** Current sequence (latest open). */
  current(): number {
    return this.seq;
  }

  /**
   * Whether a completed request may apply its result.
   * Only the latest open's seq is allowed.
   */
  isCurrent(resultSeq: number): boolean {
    return resultSeq === this.seq;
  }
}

/** Pure helper for unit tests and call sites that only need a comparison. */
export function shouldApplyOpenResult(
  currentSeq: number,
  resultSeq: number,
): boolean {
  return resultSeq === currentSeq;
}
