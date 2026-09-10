/**
 * Editor session state machine (headless): draft, mutually exclusive
 * status, per-field errors, and the delete second-confirmation prompt.
 * The overlay UI subscribes to this store; all transitions are pure
 * state updates (no I/O) so behavior is Node-testable.
 */
import type { MovieRecord } from "@auktake/core";
import { draftFromRecord, emptyDraft, type EditorDraft, type FieldErrors } from "./validation";

export type EditStatus = "closed" | "editing" | "submitting";

export interface DeletePrompt {
  readonly id: string;
  readonly title: string;
}

export interface EditSessionState {
  readonly status: EditStatus;
  /** null = create mode. */
  readonly editingId: string | null;
  readonly draft: EditorDraft;
  readonly errors: FieldErrors;
  readonly deletePrompt: DeletePrompt | null;
}

const CLOSED: EditSessionState = {
  status: "closed",
  editingId: null,
  draft: emptyDraft(""),
  errors: {},
  deletePrompt: null,
};

export class EditSessionController {
  private state: EditSessionState = CLOSED;
  private readonly listeners = new Set<(state: EditSessionState) => void>();

  getState(): EditSessionState {
    return this.state;
  }

  subscribe(listener: (state: EditSessionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** New-record mode: blank form, default watch date injected. */
  openNew(defaultWatchedAt: string): void {
    this.transition({
      status: "editing",
      editingId: null,
      draft: emptyDraft(defaultWatchedAt),
      errors: {},
      deletePrompt: null,
    });
  }

  /** Edit mode: prefilled from the existing record. */
  openRecord(record: MovieRecord): void {
    this.transition({
      status: "editing",
      editingId: record.id,
      draft: draftFromRecord(record),
      errors: {},
      deletePrompt: null,
    });
  }

  /** Update one field; clears that field's error; keeps user input. */
  setField(field: keyof EditorDraft, value: string): void {
    if (this.state.status === "closed") return;
    const errors = { ...this.state.errors };
    delete errors[field];
    this.transition({
      ...this.state,
      status: "editing",
      draft: { ...this.state.draft, [field]: value },
      errors,
    });
  }

  setMediaType(mediaType: "movie" | "episode"): void {
    if (this.state.status === "closed") return;
    this.transition({
      ...this.state,
      status: "editing",
      draft: { ...this.state.draft, mediaType },
      // S/E errors make no sense after a type switch
      errors: {},
    });
  }

  /** Show validation errors (submit blocked) — input is preserved. */
  setErrors(errors: FieldErrors): void {
    if (this.state.status === "closed") return;
    this.transition({ ...this.state, status: "editing", errors });
  }

  beginSubmit(): void {
    if (this.state.status !== "editing") return;
    this.transition({ ...this.state, status: "submitting", errors: {} });
  }

  /** Close after a successful save (or cancel). */
  close(): void {
    this.transition(CLOSED);
  }

  /** Second-confirmation prompt for deletion (spec: 删除二次确认). */
  requestDelete(record: { id: string; title: string }): void {
    this.transition({ ...this.state, deletePrompt: { id: record.id, title: record.title } });
  }

  cancelDelete(): void {
    if (this.state.deletePrompt === null) return;
    this.transition({ ...this.state, deletePrompt: null });
  }

  /** Consume the pending prompt when the user confirms. */
  takeDeletePrompt(): DeletePrompt | null {
    const prompt = this.state.deletePrompt;
    if (prompt === null) return null;
    this.transition({ ...this.state, deletePrompt: null });
    return prompt;
  }

  private transition(next: EditSessionState): void {
    this.state = next;
    for (const listener of [...this.listeners]) {
      try {
        listener(next);
      } catch {
        // listener failures are isolated
      }
    }
  }
}
