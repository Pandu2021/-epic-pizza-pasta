type Props = {
  categories: string[];
  active?: string;
  onSelect?: (value: string) => void;
};

export default function CategoryChips({ categories, active, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {categories.map((c) => (
        <button
          key={c}
          className={`chip whitespace-nowrap ${active === c ? 'bg-slate-900 text-white border-slate-900' : ''}`}
          onClick={() => onSelect?.(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
