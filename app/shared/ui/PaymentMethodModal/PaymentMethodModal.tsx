'use client'

import { useEffect, type ReactNode } from 'react';
import Modal from 'react-modal';

import type { PaymentProvider } from '@/lib/paymentConfig';
import styles from './PaymentMethodModal.module.scss';

type PaymentOption = {
  id: PaymentProvider;
  label: string;
  description: string;
  tags?: string[];
};

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children?: ReactNode;
  providers: PaymentOption[];
  message?: string;
  disabled?: boolean;
  onSelect: (provider: PaymentProvider) => void;
}

export default function PaymentMethodModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  providers,
  message,
  disabled = false,
  onSelect,
}: PaymentMethodModalProps) {
  useEffect(() => {
    const appElement = document.getElementById('__next');

    if (appElement) {
      Modal.setAppElement(appElement);
    }
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={disabled ? undefined : onClose}
      className={styles.modal}
      overlayClassName={styles.overlay}
      shouldCloseOnEsc={!disabled}
      shouldCloseOnOverlayClick={!disabled}
      ariaHideApp={false}
    >
      <div className={styles.panel}>
        <button type="button" className={styles.closeButton} onClick={onClose} disabled={disabled} aria-label="Закрыть окно выбора оплаты">
          <span />
          <span />
        </button>

        <div className={styles.hero}>
          <p className={styles.eyebrow}>Checkout</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {children ? <div className={styles.contentSlot}>{children}</div> : null}

        <div className={styles.providerGrid}>
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={styles.providerCard}
              disabled={disabled}
              onClick={() => onSelect(provider.id)}
            >
              <div className={styles.providerHeader}>
                <span className={styles.providerBadge}>{provider.id === 'tbank' ? 'Card' : provider.id === 'skins' ? 'Skins' : 'Gateway'}</span>
                <strong>{provider.label}</strong>
              </div>
              <p>{disabled ? 'Готовим ссылку на оплату...' : provider.description}</p>
              {provider.tags?.length ? (
                <div className={styles.tagList}>
                  {provider.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <span className={styles.providerAction}>{disabled ? 'Подождите...' : 'Выбрать способ'}</span>
            </button>
          ))}
        </div>

        {message ? <p className={styles.message}>{message}</p> : null}
      </div>
    </Modal>
  );
}