import { useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

type CaptchaGateProps = {
  siteKey?: string | null;
  refreshKey: number;
  onToken: (token: string | null) => void;
  theme?: 'light' | 'dark';
};

export default function CaptchaGate({ siteKey, refreshKey, onToken, theme = 'light' }: CaptchaGateProps) {
  useEffect(() => {
    if (!siteKey) {
      onToken(null);
    }
  }, [siteKey, refreshKey, onToken]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex justify-start">
      <ReCAPTCHA
        key={refreshKey}
        sitekey={siteKey}
        theme={theme}
        onChange={(token: string | null) => onToken(token || null)}
        onExpired={() => onToken(null)}
        onErrored={() => onToken(null)}
      />
    </div>
  );
}
