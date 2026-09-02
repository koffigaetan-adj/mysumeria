"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/app/components/Avatar";

const AVATAR_SIZE = 256;

/** Redimensionne et recadre la photo en carré côté navigateur → JPEG ~20-40 Ko. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ProfileForm({
  user,
}: {
  user: { email: string; firstName: string | null; lastName: string | null; avatarDataUrl: string | null };
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [avatar, setAvatar] = useState<string | null>(user.avatarDataUrl);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const dirty = firstName !== (user.firstName ?? "") || lastName !== (user.lastName ?? "") || avatar !== user.avatarDataUrl;

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatar(await toAvatarDataUrl(file));
      setNote(null);
    } catch {
      setNote({ text: "Impossible de lire cette image.", error: true });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, avatarDataUrl: avatar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ text: data.error ?? "Échec de l'enregistrement.", error: true });
        return;
      }
      setNote({ text: "Profil enregistré.", error: false });
      router.refresh();
    } catch {
      setNote({ text: "Erreur réseau.", error: true });
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";

  return (
    <form onSubmit={save}>
      <div className="flex items-center gap-4">
        <Avatar src={avatar} firstName={firstName} lastName={lastName} email={user.email} size={72} />
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-full bg-ink-900/5 px-3 py-1.5 text-xs font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
          >
            {avatar ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {avatar && (
            <button type="button" onClick={() => setAvatar(null)} className="text-xs text-ink-900/50 underline-offset-2 hover:underline dark:text-white/50">
              Retirer la photo
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" capture="user" onChange={pickPhoto} className="hidden" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-ink-900/60 dark:text-white/60">
          Prénom
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} autoComplete="given-name" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-ink-900/60 dark:text-white/60">
          Nom
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={40} autoComplete="family-name" className={inputClass} />
        </label>
      </div>

      <p className="mt-3 text-sm">
        <span className="text-ink-900/50 dark:text-white/50">Email : </span>
        {user.email}
      </p>

      {dirty && (
        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      )}
      {note && <p className={`mt-2 text-center text-xs ${note.error ? "text-red-500" : "text-brand-700 dark:text-brand-200"}`}>{note.text}</p>}
    </form>
  );
}
