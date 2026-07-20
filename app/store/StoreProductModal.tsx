'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-modal';

import type { StoreProduct, StoreRarity } from '@/types/store';
import styles from './store.module.scss';

const rarityLabel: Record<StoreRarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

const rarityColor: Record<StoreRarity, string> = {
  common: '#8a9099',
  uncommon: '#5fcf80',
  rare: '#5f89ff',
  epic: '#b86bff',
  legendary: '#f5cf53',
};

const deliveryTypeLabel: Record<string, string> = {
  item: 'Предмет',
  kit: 'Набор',
  privilege: 'Привилегия',
  currency: 'Валюта',
  command: 'Услуга',
};

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5" /></svg>
);

const MAX_QUANTITY = 99;

function formatRW(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} RW`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

type StoreProductModalProps = {
  product: StoreProduct | null;
  categoryTitle?: string | null;
  inCart?: boolean;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, quantity: number) => void;
};

export default function StoreProductModal({ product, categoryTitle, inCart = false, onClose, onAddToCart }: StoreProductModalProps) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const el = document.getElementById('__next') || document.body;
    if (el) Modal.setAppElement(el);
  }, []);

  const quantityEnabled = product ? product.deliveryType !== 'privilege' : false;
  const effectiveQuantity = quantityEnabled ? quantity : 1;
  const total = (product?.price ?? 0) * effectiveQuantity;
  const discountPercent = product && product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : null;

  return (
    <Modal
      isOpen={Boolean(product)}
      onRequestClose={onClose}
      className={styles.detailModal}
      overlayClassName={styles.overlay}
      ariaHideApp={false}
    >
      {product ? (
        <div className={styles.detailPanel}>
          <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Закрыть">×</button>

          <div className={styles.detailGrid}>
            {/* Слева — что даёт / описание */}
            <div className={styles.detailLeft}>
              <div className={styles.detailChips}>
                {categoryTitle ? <span className={styles.detailChip}>{categoryTitle}</span> : null}
                {product.rarity ? (
                  <span className={styles.detailChip} style={{ color: rarityColor[product.rarity] }}>{rarityLabel[product.rarity]}</span>
                ) : null}
                <span className={styles.detailChip}>{deliveryTypeLabel[product.deliveryType] || product.deliveryType}</span>
                {product.amount && product.amount > 1 ? (
                  <span className={styles.detailChip}>{formatNumber(product.amount)} шт.</span>
                ) : null}
              </div>

              <h2 className={styles.detailTitle}>{product.title}</h2>
              {product.description ? <p className={styles.detailDescription}>{product.description}</p> : null}

              {product.features.length > 0 ? (
                <div className={styles.detailFeatures}>
                  <span className={styles.detailFeaturesTitle}>Что даёт</span>
                  <ul>
                    {product.features.map((feature) => (
                      <li key={feature}>
                        <span className={styles.featCheck}>{CHECK}</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Справа — картинка, цена, в корзину */}
            <div className={styles.detailRight}>
              <div className={styles.detailMedia}>
                {product.badge ? <span className={styles.detailBadge}>{product.badge}</span> : null}
                {discountPercent ? <span className={styles.detailDiscount}>-{discountPercent}%</span> : null}
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.title} />
                ) : (
                  <span className={styles.detailPlaceholder}>{product.title.slice(0, 1)}</span>
                )}
              </div>

              <div className={styles.detailPriceRow}>
                {discountPercent ? <span className={styles.detailOldPrice}>{formatRW((product.oldPrice ?? 0) * effectiveQuantity)}</span> : null}
                <span className={styles.detailPrice}>{formatRW(total)}</span>
              </div>

              {quantityEnabled ? (
                <div className={styles.detailQty}>
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Меньше">−</button>
                  <input
                    type="number"
                    min={1}
                    max={MAX_QUANTITY}
                    value={quantity}
                    onChange={(event) => {
                      const next = Math.floor(Number(event.target.value));
                      setQuantity(Number.isFinite(next) ? Math.max(1, Math.min(next, MAX_QUANTITY)) : 1);
                    }}
                  />
                  <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} aria-label="Больше">+</button>
                </div>
              ) : null}

              <button type="button" className={styles.detailBuy} onClick={() => { onAddToCart(product, effectiveQuantity); onClose(); }}>
                {inCart ? 'Добавить ещё в корзину' : 'В корзину'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
