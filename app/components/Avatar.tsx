/** Photo de profil, ou initiales sur fond teal à défaut. */
export function initialsOf(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const a = (firstName ?? "").trim().charAt(0);
  const b = (lastName ?? "").trim().charAt(0);
  const initials = `${a}${b}`.toUpperCase();
  if (initials) return initials;
  return (email ?? "?").charAt(0).toUpperCase();
}

export default function Avatar({
  src,
  firstName,
  lastName,
  email,
  size = 40,
  className = "",
}: {
  src?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL, pas d'optimisation possible
    return <img src={src} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-semibold text-white ${className}`}
      aria-hidden
    >
      {initialsOf(firstName, lastName, email)}
    </span>
  );
}
