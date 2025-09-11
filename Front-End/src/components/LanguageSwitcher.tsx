import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language === 'en' ? 'th' : 'en';
    i18n.changeLanguage(next);
  };

  return (
    <button onClick={toggle} className="px-2 py-1 border rounded text-sm">
  {(i18n.language || 'en').toUpperCase()}
    </button>
  );
}
