'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  StoreAdminCatalogResponse,
  StoreCategory,
  StoreDeliveryType,
  StoreProductAdmin,
} from '@/types/store';
import { RUST_CATEGORY_LABELS, RUST_ITEMS, rustItemImage, type RustItem } from '@/lib/store/rustItems';
import styles from './StorePanel.module.scss';

const DELIVERY_TYPE_OPTIONS: { value: StoreDeliveryType; label: string }[] = [
  { value: 'item', label: 'Предмет (rwmenu.giveitem)' },
  { value: 'kit', label: 'Набор (kit)' },
  { value: 'privilege', label: 'Привилегия (группа)' },
  { value: 'currency', label: 'Валюта / монеты' },
  { value: 'command', label: 'Произвольная команда' },
];

const RARITY_OPTIONS = [
  { value: '', label: '— без редкости —' },
  { value: 'common', label: 'Обычный' },
  { value: 'uncommon', label: 'Необычный' },
  { value: 'rare', label: 'Редкий' },
  { value: 'epic', label: 'Эпический' },
  { value: 'legendary', label: 'Легендарный' },
];

type CategoryForm = {
  id: number | null;
  slug: string;
  title: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  isDefault: boolean;
};

type ProductForm = {
  id: number | null;
  categoryId: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  features: string;
  price: string;
  oldPrice: string;
  rarity: string;
  badge: string;
  amount: string;
  deliveryType: StoreDeliveryType;
  deliveryCommand: string;
  servers: string[];
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_CATEGORY: CategoryForm = { id: null, slug: '', title: '', description: '', sortOrder: '0', isActive: true, isDefault: false };

const EMPTY_PRODUCT: ProductForm = {
  id: null,
  categoryId: '',
  slug: '',
  title: '',
  description: '',
  imageUrl: '',
  features: '',
  price: '',
  oldPrice: '',
  rarity: '',
  badge: '',
  amount: '',
  deliveryType: 'item',
  deliveryCommand: 'rwmenu.giveitem ${steamId} shortname ${amount}',
  servers: [],
  isActive: true,
  sortOrder: '0',
};

export default function StorePanel() {
  const [data, setData] = useState<StoreAdminCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState('');
  const [itemCategory, setItemCategory] = useState('');

  // Блокировка выдачи из инвентаря после вайпа
  const [lockHours, setLockHours] = useState(3);
  const [lockServer, setLockServer] = useState('all');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState('');

  // Фильтр товаров по категории в админке ('' = ещё не выбрано → берётся первая категория)
  const [productCatFilter, setProductCatFilter] = useState<string>('');

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return RUST_ITEMS.filter((item) => {
      if (itemCategory && item.category !== itemCategory) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q)
        || item.shortname.toLowerCase().includes(q)
        || item.en.toLowerCase().includes(q);
    }).slice(0, 60);
  }, [itemQuery, itemCategory]);

  const applyGameItem = (item: RustItem) => {
    setProductForm((p) => ({
      ...p,
      imageUrl: rustItemImage(item.shortname),
      title: p.title.trim() ? p.title : item.name,
      slug: p.slug.trim() ? p.slug : item.shortname,
      amount: p.amount.trim() ? p.amount : '1',
      deliveryCommand: p.deliveryType === 'item'
        ? `rwmenu.giveitem \${steamId} ${item.shortname} \${amount}`
        : p.deliveryCommand,
    }));
    setItemPickerOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/store', { credentials: 'include', cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as StoreAdminCatalogResponse | null;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (body: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/store', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => null)) as StoreAdminCatalogResponse | null;

      if (!response.ok || !json?.ok) {
        setMessage(json?.error || 'Не удалось сохранить изменения.');
        return false;
      }

      setData(json);
      setMessage(successMessage);
      return true;
    } catch {
      setMessage('Не удалось сохранить изменения.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitWipeLock = async (lock: boolean) => {
    setLockBusy(true);
    setLockMsg('');
    try {
      const minutes = lock ? Math.round(Number(lockHours) * 60) : 0;
      const response = await fetch('/api/admin/wipe-lock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, serverKey: lockServer }),
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok) {
        setLockMsg(lock ? `Блокировка выдачи включена на ${lockHours} ч.` : 'Блокировка выдачи снята.');
      } else {
        const fails = Array.isArray(result?.results)
          ? result.results.filter((r: { ok: boolean }) => !r.ok).map((r: { serverKey: string; message?: string }) => `${r.serverKey}: ${r.message || 'ошибка'}`).join('; ')
          : (result?.error || 'ошибка');
        setLockMsg(`Не удалось: ${fails}`);
      }
    } catch {
      setLockMsg('Ошибка сети при отправке команды.');
    } finally {
      setLockBusy(false);
    }
  };

  const submitCategory = async () => {
    if (!categoryForm.slug.trim() || !categoryForm.title.trim()) {
      setMessage('У категории нужен slug и название.');
      return;
    }

    const ok = await mutate(
      {
        action: 'saveCategory',
        category: {
          id: categoryForm.id,
          slug: categoryForm.slug.trim(),
          title: categoryForm.title.trim(),
          description: categoryForm.description.trim() || null,
          sortOrder: Number(categoryForm.sortOrder) || 0,
          isActive: categoryForm.isActive,
          isDefault: categoryForm.isDefault,
        },
      },
      categoryForm.id ? 'Категория обновлена.' : 'Категория создана.',
    );

    if (ok) setCategoryForm(EMPTY_CATEGORY);
  };

  const submitProduct = async () => {
    if (!productForm.title.trim()) {
      setMessage('У товара нужно название.');
      return;
    }

    const ok = await mutate(
      {
        action: 'saveProduct',
        product: {
          id: productForm.id,
          categoryId: productForm.categoryId ? Number(productForm.categoryId) : null,
          slug: productForm.slug.trim(),
          title: productForm.title.trim(),
          description: productForm.description.trim() || null,
          imageUrl: productForm.imageUrl.trim() || null,
          price: Number(productForm.price) || 0,
          oldPrice: productForm.oldPrice === '' ? null : Number(productForm.oldPrice),
          rarity: productForm.rarity || null,
          badge: productForm.badge.trim() || null,
          amount: productForm.amount === '' ? null : Number(productForm.amount),
          deliveryType: productForm.deliveryType,
          deliveryCommand: productForm.deliveryCommand.trim(),
          servers: productForm.servers,
          features: productForm.features.split('\n').map((line) => line.trim()).filter(Boolean),
          isActive: productForm.isActive,
          sortOrder: Number(productForm.sortOrder) || 0,
        },
      },
      productForm.id ? 'Товар обновлён.' : 'Товар создан.',
    );

    if (ok) setProductForm(EMPTY_PRODUCT);
  };

  const editCategory = (category: StoreCategory) => {
    setCategoryForm({
      id: category.id,
      slug: category.slug,
      title: category.title,
      description: category.description || '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
      isDefault: category.isDefault,
    });
  };

  const editProduct = (product: StoreProductAdmin) => {
    setProductForm({
      id: product.id,
      categoryId: product.categoryId == null ? '' : String(product.categoryId),
      slug: product.slug,
      title: product.title,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      features: (product.features || []).join('\n'),
      price: String(product.price),
      oldPrice: product.oldPrice == null ? '' : String(product.oldPrice),
      rarity: product.rarity || '',
      badge: product.badge || '',
      amount: product.amount == null ? '' : String(product.amount),
      deliveryType: product.deliveryType,
      deliveryCommand: product.deliveryCommand,
      servers: product.servers,
      isActive: product.isActive,
      sortOrder: String(product.sortOrder),
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleProductServer = (key: string) => {
    setProductForm((current) => ({
      ...current,
      servers: current.servers.includes(key)
        ? current.servers.filter((value) => value !== key)
        : [...current.servers, key],
    }));
  };

  const categories = data?.categories ?? [];
  const products = data?.products ?? [];
  const servers = data?.servers ?? [];
  const categoryTitleById = new Map(categories.map((category) => [category.id, category.title]));
  // Активная категория для списка товаров (по умолчанию — первая)
  const activeProductCat = productCatFilter || (categories[0] ? String(categories[0].id) : 'all');
  const visibleProducts = activeProductCat === 'all'
    ? products
    : products.filter((product) => String(product.categoryId ?? '') === activeProductCat);

  if (loading && !data) {
    return <p className={styles.hint}>Загрузка магазина...</p>;
  }

  if (data && !data.databaseConfigured) {
    return (
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <h2>Магазин</h2>
          <p>Каталог товаров и привилегий с выдачей в игре.</p>
        </div>
        <div className={styles.warning}>
          База данных не подключена. Управление магазином доступно только при работающей БД (на хостинге). Локально каталог показывается как демо-набор.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <h2>Магазин</h2>
        <p>Категории, товары, цены в ₽ и команды выдачи в игре. Изменения сразу попадают на страницу /store.</p>
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}

      {/* ── Блокировка выдачи после вайпа ── */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Блокировка выдачи после вайпа</h3>
        <div className={styles.formGrid}>
          <p className={styles.hint}>Пока блок активен, игроки не смогут забрать купленные предметы из инвентаря меню (/menu). Снимется автоматически по истечении времени или кнопкой «Снять блок».</p>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Сервер</span>
              <select value={lockServer} onChange={(e) => setLockServer(e.target.value)} disabled={lockBusy}>
                <option value="all">Все серверы</option>
                {servers.map((server) => (
                  <option key={server.key} value={server.key}>{server.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Часов</span>
              <input type="number" min={1} max={720} value={lockHours} onChange={(e) => setLockHours(Number(e.target.value) || 0)} disabled={lockBusy} />
            </label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => void submitWipeLock(true)} disabled={lockBusy || lockHours <= 0}>
              {lockBusy ? '...' : 'Заблокировать выдачу'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => void submitWipeLock(false)} disabled={lockBusy}>
              Снять блок
            </button>
          </div>
          {lockMsg ? <p className={styles.hint}>{lockMsg}</p> : null}
        </div>
      </div>

      {/* ── Категории ── */}
      <div className={styles.layout}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{categoryForm.id ? 'Редактировать категорию' : 'Новая категория'}</h3>
          <div className={styles.formGrid}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Название</span>
                <input value={categoryForm.title} onChange={(e) => setCategoryForm((c) => ({ ...c, title: e.target.value }))} placeholder="Привилегии" />
              </label>
              <label className={styles.field}>
                <span>Slug (лат.)</span>
                <input value={categoryForm.slug} onChange={(e) => setCategoryForm((c) => ({ ...c, slug: e.target.value }))} placeholder="privileges" />
              </label>
            </div>
            <label className={styles.field}>
              <span>Описание</span>
              <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((c) => ({ ...c, description: e.target.value }))} />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Порядок</span>
                <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((c) => ({ ...c, sortOrder: e.target.value }))} />
              </label>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={categoryForm.isActive} onChange={(e) => setCategoryForm((c) => ({ ...c, isActive: e.target.checked }))} />
                Активна
              </label>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={categoryForm.isDefault} onChange={(e) => setCategoryForm((c) => ({ ...c, isDefault: e.target.checked }))} />
                По умолчанию
              </label>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={() => void submitCategory()} disabled={saving}>
                {categoryForm.id ? 'Сохранить' : 'Создать'}
              </button>
              {categoryForm.id ? (
                <button type="button" className={styles.secondaryButton} onClick={() => setCategoryForm(EMPTY_CATEGORY)} disabled={saving}>
                  Отмена
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Категории ({categories.length})</h3>
          <div className={styles.list}>
            {categories.map((category) => (
              <div key={category.id} className={`${styles.itemRow} ${category.isActive ? '' : styles.itemRowInactive}`}>
                <div className={styles.itemMain}>
                  <strong>{category.title}</strong>
                  <span>
                    {category.slug}
                    {category.isDefault ? ' · по умолчанию' : ''}
                    {category.isActive ? '' : ' · скрыта'}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.iconButton} onClick={() => editCategory(category)}>Изм.</button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                    onClick={() => void mutate({ action: 'deleteCategory', id: category.id }, 'Категория удалена.')}
                    disabled={saving}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 ? <p className={styles.emptyState}>Категорий пока нет.</p> : null}
          </div>
        </div>
      </div>

      {/* ── Товары ── */}
      <div className={styles.layout}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{productForm.id ? 'Редактировать товар' : 'Новый товар'}</h3>
          <div className={styles.formGrid}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Название</span>
                <input value={productForm.title} onChange={(e) => setProductForm((p) => ({ ...p, title: e.target.value }))} placeholder="VIP" />
              </label>
              <label className={styles.field}>
                <span>Slug (лат.)</span>
                <input value={productForm.slug} onChange={(e) => setProductForm((p) => ({ ...p, slug: e.target.value }))} placeholder="vip" />
              </label>
            </div>
            <label className={styles.field}>
              <span>Категория</span>
              <select value={productForm.categoryId} onChange={(e) => setProductForm((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">— без категории —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.title}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Описание</span>
              <textarea value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>Преимущества (по одному в строке)</span>
              <textarea
                value={productForm.features}
                onChange={(e) => setProductForm((p) => ({ ...p, features: e.target.value }))}
                placeholder={'Рейты +50%\nПриоритетный вход\nОтдельная роль в Discord'}
              />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Цена ₽</span>
                <input type="number" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} placeholder="299" />
              </label>
              <label className={styles.field}>
                <span>Старая цена ₽</span>
                <input type="number" value={productForm.oldPrice} onChange={(e) => setProductForm((p) => ({ ...p, oldPrice: e.target.value }))} placeholder="399" />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Количество (для выдачи)</span>
                <input type="number" value={productForm.amount} onChange={(e) => setProductForm((p) => ({ ...p, amount: e.target.value }))} placeholder="1" />
              </label>
              <label className={styles.field}>
                <span>Бейдж</span>
                <input value={productForm.badge} onChange={(e) => setProductForm((p) => ({ ...p, badge: e.target.value }))} placeholder="ХИТ" />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Редкость</span>
                <select value={productForm.rarity} onChange={(e) => setProductForm((p) => ({ ...p, rarity: e.target.value }))}>
                  {RARITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Тип выдачи</span>
                <select value={productForm.deliveryType} onChange={(e) => setProductForm((p) => ({ ...p, deliveryType: e.target.value as StoreDeliveryType }))}>
                  {DELIVERY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.field}>
              <span>Игровой предмет (иконка)</span>
              <div className={styles.itemPicker}>
                <div className={styles.itemPickerCurrent}>
                  <span className={styles.itemPickerThumb}>
                    {productForm.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={productForm.imageUrl} alt="" />
                    ) : (
                      <span>?</span>
                    )}
                  </span>
                  <button type="button" className={styles.secondaryButton} onClick={() => setItemPickerOpen((v) => !v)}>
                    {itemPickerOpen ? 'Скрыть список' : 'Выбрать предмет Rust'}
                  </button>
                </div>
                {itemPickerOpen ? (
                  <div className={styles.itemPickerPanel}>
                    <div className={styles.itemPickerControls}>
                      <input
                        type="search"
                        placeholder="Поиск: ак, сера, дверь..."
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                      />
                      <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                        <option value="">Все категории</option>
                        {Object.entries(RUST_CATEGORY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.itemPickerGrid}>
                      {filteredItems.map((item) => (
                        <button
                          key={item.shortname}
                          type="button"
                          className={styles.itemPickerCell}
                          title={`${item.name} (${item.shortname})`}
                          onClick={() => applyGameItem(item)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={rustItemImage(item.shortname)} alt={item.name} loading="lazy" />
                          <span>{item.name}</span>
                        </button>
                      ))}
                      {filteredItems.length === 0 ? <p className={styles.hint}>Ничего не найдено.</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <label className={styles.field}>
              <span>URL картинки</span>
              <input value={productForm.imageUrl} onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))} placeholder="/rust-items/rifle.ak.webp" />
            </label>
            <label className={styles.field}>
              <span>Команда выдачи (RCON)</span>
              <input value={productForm.deliveryCommand} onChange={(e) => setProductForm((p) => ({ ...p, deliveryCommand: e.target.value }))} placeholder="rwmenu.giveitem ${steamId} rifle.ak ${amount}" />
            </label>
            <p className={styles.hint}>Доступные подстановки: {'${steamId}'}, {'${amount}'}, {'${slug}'}.</p>
            <div className={styles.field}>
              <span>Серверы выдачи (пусто = все)</span>
              <div className={styles.serverChecks}>
                {servers.map((server) => (
                  <label key={server.key} className={`${styles.serverChip} ${productForm.servers.includes(server.key) ? styles.serverChipActive : ''}`}>
                    <input type="checkbox" checked={productForm.servers.includes(server.key)} onChange={() => toggleProductServer(server.key)} />
                    {server.mode}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Порядок</span>
                <input type="number" value={productForm.sortOrder} onChange={(e) => setProductForm((p) => ({ ...p, sortOrder: e.target.value }))} />
              </label>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={productForm.isActive} onChange={(e) => setProductForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Активен
              </label>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={() => void submitProduct()} disabled={saving}>
                {productForm.id ? 'Сохранить' : 'Создать'}
              </button>
              {productForm.id ? (
                <button type="button" className={styles.secondaryButton} onClick={() => setProductForm(EMPTY_PRODUCT)} disabled={saving}>
                  Отмена
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Товары ({visibleProducts.length})</h3>
          <div className={styles.catFilter}>
            <button
              type="button"
              className={`${styles.catFilterChip} ${activeProductCat === 'all' ? styles.catFilterChipActive : ''}`}
              onClick={() => setProductCatFilter('all')}
            >
              Все
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`${styles.catFilterChip} ${activeProductCat === String(category.id) ? styles.catFilterChipActive : ''}`}
                onClick={() => setProductCatFilter(String(category.id))}
              >
                {category.title}
              </button>
            ))}
          </div>
          <div className={styles.list}>
            {visibleProducts.map((product) => (
              <div key={product.id} className={`${styles.itemRow} ${product.isActive ? '' : styles.itemRowInactive}`}>
                <div className={styles.itemThumb}>
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt={product.title} />
                  ) : (
                    <span>{product.title.slice(0, 1)}</span>
                  )}
                </div>
                <div className={styles.itemMain}>
                  <strong>{product.title}</strong>
                  <span>{product.categoryId != null ? categoryTitleById.get(product.categoryId) || '—' : 'без категории'}</span>
                  <div className={styles.itemTags}>
                    <span className={styles.tag}>{product.deliveryType}</span>
                    {product.servers.length > 0 ? <span className={styles.tag}>{product.servers.join(', ')}</span> : <span className={styles.tag}>все серверы</span>}
                    {product.isActive ? null : <span className={styles.tag}>скрыт</span>}
                  </div>
                </div>
                <div className={styles.itemPrice}>{product.price} ₽</div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.iconButton} onClick={() => editProduct(product)}>Изм.</button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                    onClick={() => void mutate({ action: 'deleteProduct', id: product.id }, 'Товар удалён.')}
                    disabled={saving}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
            {visibleProducts.length === 0 ? <p className={styles.emptyState}>В этой категории товаров нет.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
