/**
 * Headless UI state for the tmdb plugin's overlay surfaces: the
 * credential/language config dialog and the backfill needs-review
 * candidate chooser. Subscribe pattern identical to Phase 1 stores.
 */
import type { TmdbCandidate } from "@auktake/ui-contracts";

export interface TmdbUiState {
  readonly configOpen: boolean;
  /** needs-review backfill: user picks a candidate to bind. */
  readonly review: { readonly recordId: string; readonly candidates: readonly TmdbCandidate[] } | null;
}

export class TmdbUiStore {
  private state: TmdbUiState = { configOpen: false, review: null };
  private readonly listeners = new Set<() => void>();

  getState = (): TmdbUiState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  openConfig(): void {
    this.state = { ...this.state, configOpen: true };
    this.notify();
  }

  closeConfig(): void {
    this.state = { ...this.state, configOpen: false };
    this.notify();
  }

  openReview(recordId: string, candidates: readonly TmdbCandidate[]): void {
    this.state = { ...this.state, review: { recordId, candidates } };
    this.notify();
  }

  closeReview(): void {
    this.state = { ...this.state, review: null };
    this.notify();
  }

  private notify(): void {
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        // isolated
      }
    }
  }
}
