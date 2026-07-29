import type { SettingCategory } from './settingDefinitions';

const paths: Record<SettingCategory, React.ReactNode> = {
  'prompt-rewrite': (
    <>
      <path d="M4 17.5 6.2 12l9.7-9.7 3.8 3.8L10 15.8 4 17.5Z" />
      <path d="m13.8 4.4 3.8 3.8M3 7h4M5 5v4" />
    </>
  ),
  timeline: (
    <>
      <path d="M5 4v16M5 7h5l2-2h7M5 12h7l2-2h5M5 17h4l2-2h8" />
    </>
  ),
  'prompt-manager': (
    <>
      <path d="M5 3h11a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-2 1V4a1 1 0 0 1 1-1Z" />
      <path d="M8 7h7M8 11h5" />
    </>
  ),
  input: (
    <>
      <path d="M4 5h16v12H4zM8 20h8M12 17v3" />
      <path d="M7 9h2M11 9h2M15 9h2M7 13h10" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M9 10h12" />
    </>
  ),
  font: (
    <>
      <path d="M5 19 10.5 4h3L19 19M7 14h10M3 4h5M16 4h5" />
    </>
  ),
  markdown: (
    <>
      <path d="m4 7 4 5-4 5M20 7l-4 5 4 5M13.5 5 10 19" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5M5 19h14" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7ZM10 20h4" />
    </>
  ),
  experimental: (
    <>
      <path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <path d="M8 15h8" />
    </>
  ),
  privacy: (
    <>
      <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  'data-management': (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  diagnostics: (
    <>
      <path d="M4 18V9M10 18V5M16 18v-7M22 18H2" />
      <circle cx="16" cy="7" r="2" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
};

export function SettingsIcon({
  category,
  className = '',
}: {
  category: SettingCategory;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[category]}
    </svg>
  );
}
