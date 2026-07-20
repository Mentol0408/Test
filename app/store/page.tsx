'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Modal from 'react-modal';

import Header from '@/widgets/header/Header';
import PaymentMethodModal from '@/shared/ui/PaymentMethodModal/PaymentMethodModal';
import {
  BALANCE_UPDATED_EVENT,
  emitBalanceUpdated,
  isBalanceUpdatedEvent,
  type BalanceUpdatedDetail,
} from '@/lib/balanceEvents';
import { BALANCE_TOPUP, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/paymentConfig';
import type { BalanceSummaryResponse } from '@/types/balance';
import type { StoreCatalogResponse, StoreProduct, StorePurchaseResponse } from '@/types/store';
import StoreProductModal from './StoreProductModal';
import styles from './store.module.scss';

const MAX_QUANTITY = 99;

type CartLine = { product: StoreProduct; quantity: number };

const PURCHASE_ERROR_LABELS: Record<string, string> = {
  AUTH_REQUIRED: 'Войдите через Steam, чтобы покупать.',
  INSUFFICIENT_BALANCE: 'Недостаточно средств на балансе. Пополните баланс.',
  DATABASE_UNAVAILABLE: 'Магазин временно недоступен. Попробуйте позже.',
  DELIVERY_FAILED: 'Не удалось выдать товар в игре. Баланс возвращён.',
  PARTIAL_DELIVERY: 'Выдана только часть. За невыданное баланс возвращён.',
  PRODUCT_NOT_FOUND: 'Товар не найден или снят с продажи.',
  SERVER_NOT_ALLOWED: 'Этот товар недоступен на выбранном сервере.',
  INVALID_PRODUCT: 'Товар недоступен к покупке.',
};

function formatRW(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} RW`;
}

function isProductAvailableOnServer(product: StoreProduct, serverKey: string) {
  return product.servers.length === 0 || product.servers.includes(serverKey);
}

const ICONS: Record<string, ReactNode> = {
  trophy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0112 0M16 5.5a3 3 0 010 5.6M21 20a6 6 0 00-5-5.9" /></svg>,
  swords: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.5 3.5L21 3v6l-6.5.5M3 21l6-6M21 3l-9 9M3.5 14.5L3 21h6M3 3l9 9" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>,
  fire: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-1-5 3 0 3-3 3-3z" /></svg>,
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 11l8-7 8 7M6 10v9h12v-9" /></svg>,
  coin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8" /><path d="M9.5 10a2.5 2 0 012.5-2c1.4 0 2.5.9 2.5 2s-1 1.5-2.5 2-2.5 1-2.5 2 1.1 2 2.5 2a2.5 2 0 002.5-2M12 6v1.8M12 16.2V18" /></svg>,
  cart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L22 8H6" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  video: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></svg>,
  gift: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 12v8H4v-8M2 8h20v4H2zM12 8V4M12 8c-2 0-4-1-4-3 0 0 4 0 4 3zM12 8c2 0 4-1 4-3 0 0-4 0-4 3z" /></svg>,
};

export default function StorePage() {
  const [catalog, setCatalog] = useState<StoreCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [balance, setBalance] = useState(0);
  const [isBalanceAvailable, setIsBalanceAvailable] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [checkoutTone, setCheckoutTone] = useState<'error' | 'success'>('error');

  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(BALANCE_TOPUP.defaultAmount);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMessage, setTopupMessage] = useState('');

  useEffect(() => {
    const el = document.getElementById('__next') || document.body;
    if (el) Modal.setAppElement(el);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/store/catalog', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: StoreCatalogResponse) => {
        if (!mounted) return;
        setCatalog(data);
        setSelectedServer(data.servers.find((server) => server.key === 'chill')?.key ?? data.servers[0]?.key ?? '');
        setActiveCategory(data.categories.find((category) => category.isDefault)?.slug ?? 'all');
      })
      .catch(() => { if (mounted) setCatalog(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const applyBalance = (detail: BalanceUpdatedDetail) => {
      if (!mounted) return;
      setIsAuthenticated(detail.isAuthenticated);
      setIsBalanceAvailable(detail.databaseConfigured);
      setBalance(detail.isAuthenticated && detail.databaseConfigured ? detail.balance : 0);
    };
    const refreshBalance = async () => {
      try {
        const response = await fetch('/api/balance', { credentials: 'include', cache: 'no-store' });
        const data = (await response.json().catch(() => null)) as BalanceSummaryResponse | null;
        if (!mounted || !data) return;
        applyBalance({ balance: data.balance ?? 0, isAuthenticated: Boolean(data.isAuthenticated), databaseConfigured: data.databaseConfigured !== false });
      } catch {
        if (mounted) { setIsAuthenticated(false); setIsBalanceAvailable(false); setBalance(0); }
      }
    };
    const handleBalanceEvent = (event: Event) => { if (isBalanceUpdatedEvent(event)) applyBalance(event.detail); };
    window.addEventListener(BALANCE_UPDATED_EVENT, handleBalanceEvent);
    void refreshBalance();
    return () => { mounted = false; window.removeEventListener(BALANCE_UPDATED_EVENT, handleBalanceEvent); };
  }, []);

  const products = useMemo(() => catalog?.products ?? [], [catalog]);
  const categories = useMemo(() => catalog?.categories ?? [], [catalog]);
  const servers = useMemo(() => catalog?.servers ?? [], [catalog]);

  useEffect(() => {
    if (categories.length === 0) {
      if (activeCategory !== 'all') setActiveCategory('all');
      return;
    }

    if (activeCategory === 'all') {
      return;
    }

    const hasActiveCategory = categories.some((category) => category.slug === activeCategory);
    if (!hasActiveCategory) {
      setActiveCategory(categories.find((category) => category.isDefault)?.slug ?? 'all');
    }
  }, [categories, activeCategory]);

  const visibleProducts = useMemo(
    () => products.filter((product) => !selectedServer || isProductAvailableOnServer(product, selectedServer)),
    [products, selectedServer],
  );
  const listProducts = useMemo(
    () => (activeCategory === 'all' ? visibleProducts : visibleProducts.filter((p) => p.categorySlug === activeCategory)),
    [visibleProducts, activeCategory],
  );

  // Топ-цена (самый дорогой товар) и топ-скидка (макс. % скидки) по всему каталогу — для цветной рамки.
  const { topPriceId, topDiscountId } = useMemo(() => {
    let topPriceId: number | null = null;
    let topDiscountId: number | null = null;
    let maxPrice = -1;
    let maxDiscount = 0;
    for (const p of products) {
      if (p.price > maxPrice) { maxPrice = p.price; topPriceId = p.id; }
      const d = p.oldPrice && p.oldPrice > p.price ? 1 - p.price / p.oldPrice : 0;
      if (d > maxDiscount) { maxDiscount = d; topDiscountId = p.id; }
    }
    return { topPriceId, topDiscountId };
  }, [products]);

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);


  const addToCart = (product: StoreProduct, quantity = 1) => {
    if (checkoutLoading) return; // во время оплаты корзину не трогаем — иначе рассинхрон «выдано»
    setCheckoutMessage('');
    const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity) || 1));
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        if (product.deliveryType === 'privilege') return current;
        return current.map((line) => line.product.id === product.id
          ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + qty) } : line);
      }
      return [...current, { product, quantity: product.deliveryType === 'privilege' ? 1 : qty }];
    });
  };
  const setLineQuantity = (productId: number, quantity: number) => {
    setCart((current) => current.map((line) => line.product.id === productId
      ? { ...line, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : line));
  };
  const removeFromCart = (productId: number) => setCart((current) => current.filter((line) => line.product.id !== productId));

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!isAuthenticated) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `/api/steam/login?returnTo=${returnTo}`;
      return;
    }
    if (!selectedServer) { setCheckoutTone('error'); setCheckoutMessage('Выберите сервер выдачи.'); return; }
    if (cartTotal > balance) { setCheckoutTone('error'); setCheckoutMessage('Недостаточно средств. Пополните баланс.'); return; }

    setCheckoutLoading(true);
    setCheckoutMessage('');
    let lastBalance = balance;
    const failed: string[] = [];
    const succeeded: number[] = [];

    for (const line of cart) {
      try {
        const response = await fetch('/api/store/purchase', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: line.product.id, serverKey: selectedServer, quantity: line.quantity }),
        });
        const data = (await response.json().catch(() => null)) as StorePurchaseResponse | null;
        if (response.status === 401) {
          const returnTo = encodeURIComponent(window.location.href);
          window.location.href = `/api/steam/login?returnTo=${returnTo}`;
          return;
        }
        if (response.ok && data?.ok) {
          succeeded.push(line.product.id);
          if (typeof data.balance === 'number') lastBalance = data.balance;
        } else {
          if (typeof data?.balance === 'number') lastBalance = data.balance;
          failed.push(`${line.product.title}: ${(data?.error && PURCHASE_ERROR_LABELS[data.error]) || 'ошибка'}`);
        }
      } catch {
        failed.push(`${line.product.title}: ошибка сети`);
      }
    }

    setBalance(lastBalance);
    emitBalanceUpdated({ balance: lastBalance, isAuthenticated: true, databaseConfigured: true });
    setCart((current) => current.filter((line) => !succeeded.includes(line.product.id)));
    if (failed.length === 0) {
      setCheckoutTone('success');
      setCheckoutMessage('Оплачено! Товары выданы в игре. Зайдите на сервер, чтобы забрать.');
    } else {
      setCheckoutTone('error');
      setCheckoutMessage(`Часть товаров не куплена — ${failed.join('; ')}`);
    }
    setCheckoutLoading(false);
  };

  const openTopup = () => {
    // Показываем способы оплаты сразу; авторизация проверяется при выборе провайдера.
    setTopupMessage(isAuthenticated ? '' : 'Войди через Steam, чтобы завершить пополнение.');
    setIsTopupOpen(true);
  };

  const handleTopup = async (provider: PaymentProvider) => {
    const endpoint = provider === 'enot' ? '/api/enot/create-payment' : '/api/tbank/create-payment';
    setTopupLoading(true);
    setTopupMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentType: 'balance_topup', amount: topupAmount }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) { setTopupMessage('Войдите через Steam, чтобы пополнить баланс.'); return; }
      if (!response.ok || !data?.ok || !data?.url) { setTopupMessage('Эта платёжная система ещё не настроена.'); return; }
      window.location.href = data.url;
    } catch {
      setTopupMessage('Не удалось создать платёж. Попробуйте ещё раз.');
    } finally {
      setTopupLoading(false);
    }
  };


  return (
    <main className={styles.page}>
      <Header onHallOfFameOpen={() => { window.location.href = '/'; }} />

      {/* ── Товары магазина ── */}
      <section id="catalog" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Товары магазина</h2>
          <div className={styles.rwBadge}><span className={styles.coin}>RW</span> Rust Way</div>
        </div>

        {!loading && catalog?.source === 'seed' ? (
          <p className={styles.seedNotice}>Демо-каталог (БД не подключена). На сервере магазином управляет админка.</p>
        ) : null}

        {servers.length > 1 ? (
          <div className={styles.serverBar}>
            <span className={styles.serverBarLabel}>Сервер выдачи</span>
            <div className={styles.serverBarRow}>
              {servers.map((server) => {
                const active = selectedServer === server.key;
                return (
                  <button
                    key={server.key}
                    type="button"
                    className={`${styles.serverBarBtn} ${active ? styles.serverBarBtnActive : ''}`}
                    onClick={() => setSelectedServer(server.key)}
                    style={active ? { borderColor: server.accent } : undefined}
                  >
                    {server.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={server.image} alt={server.label} className={styles.serverBarLogo} />
                    ) : (
                      <span>{server.mode}</span>
                    )}
                    <span className={styles.serverBarRate} style={{ color: server.accent }}>{server.rate}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {servers.length > 0 ? (
          <div className={styles.catTabs}>
            <button type="button" className={`${styles.catTab} ${activeCategory === 'all' ? styles.catTabActive : ''}`} onClick={() => setActiveCategory('all')}>Все</button>
            {categories.map((category) => {
              const count = visibleProducts.filter((p) => p.categorySlug === category.slug).length;
              if (count === 0) return null;
              return (
                <button key={category.id} type="button" className={`${styles.catTab} ${activeCategory === category.slug ? styles.catTabActive : ''}`} onClick={() => setActiveCategory(category.slug)}>{category.title}</button>
              );
            })}
          </div>
        ) : null}

        {loading ? (
          <div className={styles.productGrid} aria-label="Загрузка каталога">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="rw-skeleton" style={{ borderRadius: 18, aspectRatio: "3 / 4" }} />
            ))}
          </div>
        ) : listProducts.length === 0 ? (
          <p className={styles.emptyState}>Товаров пока нет.</p>
        ) : (
          <div className={styles.productGrid}>
            {listProducts.map((product) => {
              const inCart = cart.some((line) => line.product.id === product.id);
              const discount = product.oldPrice && product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : null;
              const isTopPrice = product.id === topPriceId;
              const isTopDiscount = product.id === topDiscountId;
              const isGold = product.slug === 'vip';
              return (
                <article
                  key={product.id}
                  className={`${styles.product} ${isGold ? styles.productGold : ''} ${isTopPrice && !isGold ? styles.productTopPrice : ''} ${isTopDiscount && !isGold ? styles.productTopDiscount : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailProduct(product)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailProduct(product); } }}
                >
                  <div className={styles.productMedia}>
                    <div className={styles.productTags}>
                      {product.badge ? <span className={styles.productBadge}>{product.badge}</span> : null}
                      {isTopPrice ? <span className={`${styles.productBadge} ${styles.topPriceTag}`}>Топ цена</span> : null}
                      {isTopDiscount ? <span className={`${styles.productBadge} ${styles.topDiscountTag}`}>Топ скидка</span> : null}
                    </div>
                    {discount ? <span className={styles.productDiscount}>-{discount}%</span> : null}
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.title} loading="lazy" />
                    ) : (
                      <span className={styles.productPlaceholder}>{product.title.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className={styles.productBody}>
                    <h3 className={styles.productTitle}>{product.title}</h3>
                    <div className={styles.productFooter}>
                      <div className={styles.productPriceBox}>
                        {product.oldPrice && product.oldPrice > product.price ? <span className={styles.productOldPrice}>{formatRW(product.oldPrice)}</span> : null}
                        <span className={styles.productPrice}>{formatRW(product.price)}</span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.addBtn} ${inCart ? styles.addBtnIn : ''}`}
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        aria-label="В корзину"
                      >
                        {inCart ? ICONS.check : ICONS.cart}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Rust Way. Все права защищены.</span>
        <span>Наш проект не связан с Facepunch Studios.</span>
      </footer>

      {/* ── Плавающая корзина ── */}
      <button type="button" className={styles.cartFab} onClick={() => setIsCartOpen(true)} aria-label="Корзина">
        {ICONS.cart}
        {cartCount > 0 ? <span className={styles.cartFabBadge}>{cartCount}</span> : null}
      </button>

      <Modal
        isOpen={isCartOpen}
        onRequestClose={() => { if (!checkoutLoading) setIsCartOpen(false); }}
        className={styles.cartModal}
        overlayClassName={styles.overlay}
        ariaHideApp={false}
      >
        <div className={styles.cartPanel}>
          <div className={styles.cartHead}>
            <span className={styles.cartHeadIcon}>{ICONS.cart}</span>
            <span>Корзина</span>
            <button type="button" className={styles.cartClose} onClick={() => { if (!checkoutLoading) setIsCartOpen(false); }} aria-label="Закрыть">×</button>
          </div>

          {cart.length === 0 ? (
            <p className={styles.cartEmpty}>Корзина пуста. Добавь товары из каталога.</p>
          ) : (
            <div className={styles.cartLines}>
              {cart.map((line) => (
                <div key={line.product.id} className={styles.cartLine}>
                  <span className={styles.cartThumb}>
                    {line.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.product.imageUrl} alt={line.product.title} />
                    ) : (<span>{line.product.title.slice(0, 1)}</span>)}
                  </span>
                  <span className={styles.cartLineMain}>
                    <strong>{line.product.title}</strong>
                    <span className={styles.cartLinePrice}>{formatRW(line.product.price * line.quantity)}</span>
                  </span>
                  {line.product.deliveryType !== 'privilege' ? (
                    <span className={styles.cartQty}>
                      <button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity - 1)} disabled={checkoutLoading}>−</button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity + 1)} disabled={checkoutLoading}>+</button>
                    </span>
                  ) : null}
                  <button type="button" className={styles.cartRemove} onClick={() => removeFromCart(line.product.id)} disabled={checkoutLoading} aria-label="Убрать">×</button>
                </div>
              ))}
            </div>
          )}

          {servers.length > 1 ? (
            <div className={styles.cartServers}>
              <span>Сервер выдачи</span>
              <div>
                {servers.map((server) => (
                  <button
                    key={server.key}
                    type="button"
                    className={`${styles.cartServer} ${selectedServer === server.key ? styles.cartServerActive : ''}`}
                    onClick={() => setSelectedServer(server.key)}
                  >{server.mode} {server.rate}</button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.cartTotalRow}>
            <span>Итого</span>
            <strong>{formatRW(cartTotal)}</strong>
          </div>
          <div className={styles.cartActions}>
            <button type="button" className={styles.btnGhostSm} onClick={openTopup}>Пополнить</button>
            <button type="button" className={styles.btnPrimary} onClick={() => void handleCheckout()} disabled={checkoutLoading || cart.length === 0}>
              {checkoutLoading ? 'Оплачиваем...' : !isAuthenticated ? 'Войти и оплатить' : 'Перейти к оплате'}
            </button>
          </div>
          {isAuthenticated && isBalanceAvailable ? <p className={styles.cartBalance}>Ваш баланс: {formatRW(balance)}</p> : null}
          {checkoutMessage ? <p className={`${styles.cartMessage} ${checkoutTone === 'success' ? styles.cartMessageSuccess : ''}`}>{checkoutMessage}</p> : null}
        </div>
      </Modal>

      <StoreProductModal
        key={detailProduct?.id ?? 'store-product-modal'}
        product={detailProduct}
        categoryTitle={detailProduct ? (categories.find((c) => c.id === detailProduct.categoryId)?.title ?? null) : null}
        inCart={detailProduct ? cart.some((line) => line.product.id === detailProduct.id) : false}
        onClose={() => setDetailProduct(null)}
        onAddToCart={(product, quantity) => { addToCart(product, quantity); }}
      />

      <PaymentMethodModal
        isOpen={isTopupOpen}
        onClose={() => { if (!topupLoading) setIsTopupOpen(false); }}
        title="Пополнение баланса"
        subtitle={`Пополнение на ${topupAmount} ₽`}
        disabled={topupLoading}
        providers={PAYMENT_PROVIDERS}
        onSelect={(provider) => void handleTopup(provider)}
        message={topupMessage}
      >
        <div className={styles.topupControls}>
          <div className={styles.topupHeader}>
            <p>Сумма пополнения</p>
            <strong>{topupAmount} ₽</strong>
          </div>
          <input
            type="range"
            min={BALANCE_TOPUP.min}
            max={BALANCE_TOPUP.max}
            step={BALANCE_TOPUP.step}
            value={topupAmount}
            onChange={(event) => setTopupAmount(Number(event.target.value))}
            className={styles.topupSlider}
          />
          <p className={styles.topupHint}>Выберите сумму, затем платёжный способ ниже.</p>
        </div>
      </PaymentMethodModal>
    </main>
  );
}
