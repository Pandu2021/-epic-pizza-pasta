import { getAdminUrl, isAdminApp } from '../config/appConfig';

export default function AdminLink() {
  if (isAdminApp) return null;

  const url = getAdminUrl();
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-slate-700"
    >
      <span className="inline-block size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
      Admin Console
    </a>
  );
}
