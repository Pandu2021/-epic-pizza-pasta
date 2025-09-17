import { ShoppingCartIcon, FireIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';

type Props = {
  name: string | JSX.Element;
  price: number;
  priceL?: number;
  priceXL?: number;
  imageUrl?: string;
  label?: 'bestseller' | 'spicy' | 'new';
  description?: string | JSX.Element;
  /** Quick add handler (no options). If omitted and `to` exists + variant = 'options', button will navigate instead */
  onAdd?: () => void;
  /** Link to detail page */
  to?: string;
  /** Behaviour of the main CTA. 'quick-add' keeps old behaviour, 'options' navigates to detail page */
  variant?: 'quick-add' | 'options';
};
export default function ProductCard({ name, price, priceL, priceXL, imageUrl, label, description, onAdd, to, variant = 'quick-add' }: Props) {
  const { t } = useTranslation();
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();

  const handleAddOrNavigate = () => {
    if (variant === 'options' && to) {
      navigate(to);
      return;
    }
    if (onAdd) onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleCardClick = () => {
    if (to) {
      navigate(to);
    }
  };

  return (
    <motion.div
      className={`card overflow-hidden group transition-shadow duration-300 ease-in-out hover:shadow-xl flex flex-col ${to ? 'cursor-pointer' : ''}`}
      whileHover={{ scale: 1.03 }}
      onClick={handleCardClick}
    >
      <div className="aspect-video block bg-slate-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={typeof name === 'string' ? name : ''}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-slate-400">{t('no_image')}</div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
          <div className="flex items-start gap-2">
            <h3 className="font-medium truncate flex-1">{name}</h3>
            {label === 'spicy' && <FireIcon title="Spicy" className="size-4 text-red-500 flex-shrink-0" />}
            {label === 'bestseller' && <span className="chip border-amber-300 bg-amber-50 text-xs flex-shrink-0">{t('best_seller')}</span>}
            {label === 'new' && <span className="chip border-emerald-300 bg-emerald-50 text-xs flex-shrink-0">{t('new')}</span>}
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-600">
              {typeof description === 'string' ? (
                description.length > 100 ? `${description.slice(0, 100)}…` : description
              ) : (
                description
              )}
            </p>
          )}
        </div>
        <div className="mt-4">
          <div className="text-sm text-slate-500">{t('from')}</div>
          <div className="mt-0.5 text-lg font-semibold">
            {priceL != null && priceXL != null ? (
              <span>฿ {priceL.toFixed(0)} / ฿ {priceXL.toFixed(0)}</span>
            ) : (
              <span>฿ {price.toFixed(0)}</span>
            )}
          </div>
          <button
            className={`btn w-full mt-3 transition-colors duration-300 ${
              added ? 'bg-emerald-500 hover:bg-emerald-600' : 'btn-primary'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleAddOrNavigate();
            }}
            disabled={variant === 'quick-add' && added}
          >
            {variant === 'options' ? (
              <>
                {t('choose_options', 'Choose Options')}
              </>
            ) : added ? (
              <>
                <CheckIcon className="size-5 mr-2" /> {t('added_to_cart', 'Added!')}
              </>
            ) : (
              <>
                <ShoppingCartIcon className="size-5 mr-2" /> {t('add_to_cart')}
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
