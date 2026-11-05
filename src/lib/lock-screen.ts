/**
 * Lock-screen "Now Playing" card for the customer's order, from the browser,
 * no install needed (iPhone and Android).
 *
 * How: after the customer's "Enable sound" tap, a plain <audio> element loops
 * an inaudible track (public/lockscreen.mp3, about -79 dB). While a page plays
 * media, the phone treats it like a music app: it keeps the page running with
 * the screen locked and shows a player on the lock screen. The Media Session
 * API lets us fill that player with the order: "Order 42 · ready in ~4 min",
 * the shop name and its logo. When the order is ready the same element
 * switches to the beeper sound, so it rings even with the phone locked.
 *
 * Web Audio (the in-page beeper) is paused by iOS in the background; a media
 * element isn't. That's why the ring goes through this element when it runs.
 */

export type LockStatus = "preparing" | "ready";

/** Title shown on the lock screen. Pure, so it's unit-tested. */
export function lockScreenTitle(
  t: (key: "lock.preparing" | "lock.eta" | "lock.ready", v?: Record<string, string | number>) => string,
  status: LockStatus,
  orderNumber: string,
  etaMinutes: number | null,
): string {
  if (status === "ready") return t("lock.ready", { n: orderNumber });
  if (etaMinutes !== null && etaMinutes >= 1) return t("lock.eta", { n: orderNumber, m: etaMinutes });
  return t("lock.preparing", { n: orderNumber });
}

const QUIET_SRC = "/lockscreen.mp3";
const RING_SRC = "/ready.mp3";

type Meta = { title: string; artist: string; artwork: string | null };

export class LockScreenPlayer {
  private el: HTMLAudioElement | null = null;
  private mode: "off" | "quiet" | "ring" = "off";
  private meta: Meta | null = null;

  get active() {
    return this.mode !== "off";
  }

  get ringing() {
    return this.mode === "ring";
  }

  static supported(): boolean {
    return typeof window !== "undefined" && typeof Audio !== "undefined";
  }

  /**
   * Must be called inside the user's tap (browsers only allow sound to start
   * from a gesture): play() is called synchronously, the promise only reports
   * whether it worked. Safe to call more than once.
   */
  start(meta: Meta): Promise<boolean> {
    if (!LockScreenPlayer.supported()) return Promise.resolve(false);
    this.meta = meta;
    if (!this.el) {
      const el = document.createElement("audio");
      el.setAttribute("playsinline", "");
      el.preload = "auto";
      el.loop = true;
      el.dataset.testid = "lock-audio";
      el.style.display = "none";
      document.body.appendChild(el);
      this.el = el;
      this.bindControls();
    }
    if (this.mode === "off") {
      this.el.src = QUIET_SRC;
      this.mode = "quiet";
    }
    const playing = this.el.play().then(
      () => {
        this.applyMeta();
        return true;
      },
      () => {
        if (this.mode === "quiet") this.mode = "off";
        return false;
      },
    );
    this.applyMeta();
    return playing;
  }

  update(meta: Meta) {
    this.meta = meta;
    if (this.active) this.applyMeta();
  }

  /** Switch to the beeper sound (works with the screen locked). */
  ring() {
    if (!this.el || this.mode === "off" || this.mode === "ring") return;
    this.mode = "ring";
    this.el.src = RING_SRC;
    this.el.play().catch(() => {});
    this.applyMeta();
  }

  /** Back to the silent loop (order not ready any more, e.g. undone). */
  quiet() {
    if (!this.el || this.mode !== "ring") return;
    this.mode = "quiet";
    this.el.src = QUIET_SRC;
    this.el.play().catch(() => {});
    this.applyMeta();
  }

  /** Order picked up / closed: remove the card and free everything. */
  stop() {
    this.mode = "off";
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
    }
    const ms = mediaSession();
    if (ms) {
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch {}
    }
  }

  destroy() {
    this.stop();
    this.el?.remove();
    this.el = null;
  }

  private applyMeta() {
    const ms = mediaSession();
    if (!ms || !this.meta || typeof MediaMetadata === "undefined") return;
    try {
      const art = this.meta.artwork || "/icon-512.png";
      ms.metadata = new MediaMetadata({
        title: this.meta.title,
        artist: this.meta.artist,
        album: "Beep",
        artwork: [
          { src: art, sizes: "512x512" },
          { src: art, sizes: "192x192" },
        ],
      });
      ms.playbackState = "playing";
      // A live status, not a song: hide the progress where the phone allows.
      ms.setPositionState?.({ duration: 0, position: 0, playbackRate: 1 });
    } catch {}
  }

  private bindControls() {
    const ms = mediaSession();
    if (!ms) return;
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {}
    };
    // Play/pause from the lock screen keep working; skip buttons do nothing.
    set("play", () => {
      this.el?.play().catch(() => {});
      if (ms) ms.playbackState = "playing";
    });
    set("pause", () => {
      this.el?.pause();
      if (ms) ms.playbackState = "paused";
    });
    for (const a of ["seekbackward", "seekforward", "previoustrack", "nexttrack", "seekto"] as MediaSessionAction[]) {
      set(a, null);
    }
  }
}

function mediaSession(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
}
