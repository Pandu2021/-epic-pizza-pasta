import { useEffect, useState } from 'react';

type Props = { message: string; duration?: number };
export default function Toast({ message, duration = 2000 }: Props) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(id);
  }, [duration]);
  if (!open) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded shadow-lg">
      {message}
    </div>
  );
}
