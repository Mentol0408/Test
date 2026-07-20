'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BotInventoryItem, CaseAdminResponse, CaseDefinition, CaseRarity } from '@/types/cases';
import styles from './CasesPanel.module.scss';

const RARITY_OPTIONS: Array<{ value: CaseRarity; label: string; color: string }> = [
  { value: 'common', label: 'Обычный', color: '#9aa6b4' },
  { value: 'rare', label: 'Редкий', color: '#4a90ff' },
  { value: 'mythical', label: 'Мифический', color: '#b15bff' },
  { value: 'fake', label: 'Фейк', color: '#ff6b6b' },
];

type CaseFormState = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  accent: string;
  isActive: boolean;
};

type ItemFormState = {
  id: number | null;
  caseId: string;
  name: string;
  rarity: CaseRarity;
  sellPrice: string;
  imageUrl: string;
  dropChance: string;
  isActive: boolean;
  isFake: boolean;
  sortOrder: string;
  botSelection: string;
};

const EMPTY_CASE: CaseFormState = {
  id: '',
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  accent: '#ff4d4d',
  isActive: true,
};

const EMPTY_ITEM: ItemFormState = {
  id: null,
  caseId: '',
  name: '',
  rarity: 'common',
  sellPrice: '',
  imageUrl: '',
  dropChance: '',
  isActive: true,
  isFake: false,
  sortOrder: '0',
  botSelection: '',
};

export default function CasesPanel() {
  const [data, setData] = useState<CaseAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [caseForm, setCaseForm] = useState<CaseFormState>(EMPTY_CASE);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM);
  const [selectedCaseId, setSelectedCaseId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cases', { credentials: 'include', cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as CaseAdminResponse | null;
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
      const response = await fetch('/api/admin/cases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => null)) as CaseAdminResponse | null;

      if (!response.ok || !json?.ok) {
        setMessage(json?.error || 'Не удалось сохранить кейсы.');
        return false;
      }

      setData(json);
      setMessage(successMessage);
      return true;
    } catch {
      setMessage('Не удалось сохранить кейсы.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const cases = data?.cases ?? [];
  const selectedCase = cases.find((item) => item.id === selectedCaseId) || null;
  const visibleItems = selectedCase?.items ?? [];
  const botItems = data?.botItems ?? [];
  const selectedBotItem = botItems.find((item) => item.name === itemForm.botSelection) || null;

  const openCaseEditor = (caseDef: CaseDefinition) => {
    setSelectedCaseId(caseDef.id);
    setCaseForm({
      id: caseDef.id,
      name: caseDef.name,
      description: caseDef.description || '',
      price: String(caseDef.price),
      imageUrl: caseDef.imageUrl,
      accent: caseDef.accent,
      isActive: caseDef.isActive,
    });
    setItemForm({ ...EMPTY_ITEM, caseId: caseDef.id });
  };

  const openItemEditor = (item: CaseDefinition['items'][number]) => {
    setSelectedCaseId(item.caseId);
    setItemForm({
      id: item.id,
      caseId: item.caseId,
      name: item.name,
      rarity: item.isFake ? 'fake' : item.rarity,
      sellPrice: String(item.sellPrice),
      imageUrl: item.imageUrl || '',
      dropChance: String(item.dropChance),
      isActive: item.isActive,
      isFake: item.isFake,
      sortOrder: String(item.sortOrder),
      botSelection: item.name,
    });
  };

  const submitSettings = async (settings: { casesEnabled: boolean; adminOnlyOpen: boolean }, successMessage: string) => {
    await mutate({ action: 'saveSettings', settings }, successMessage);
  };

  const submitCase = async () => {
    if (!caseForm.id.trim() || !caseForm.name.trim() || !caseForm.imageUrl.trim()) {
      setMessage('У кейса должны быть id, название и картинка.');
      return;
    }

    const ok = await mutate(
      {
        action: 'saveCase',
        caseDef: {
          id: caseForm.id.trim(),
          name: caseForm.name.trim(),
          description: caseForm.description.trim(),
          price: Number(caseForm.price) || 0,
          imageUrl: caseForm.imageUrl.trim(),
          accent: caseForm.accent.trim() || '#ff4d4d',
          isActive: caseForm.isActive,
        },
      },
      'Кейс сохранён.',
    );

    if (ok) {
      setSelectedCaseId(caseForm.id.trim());
      setItemForm((current) => ({ ...EMPTY_ITEM, caseId: caseForm.id.trim() || current.caseId }));
    }
  };

  const removeCase = async (caseId: string) => {
    const ok = await mutate({ action: 'deleteCase', caseId }, 'Кейс удалён.');
    if (ok && selectedCaseId === caseId) {
      setSelectedCaseId('');
      setItemForm(EMPTY_ITEM);
      setCaseForm(EMPTY_CASE);
    }
  };

  const submitItem = async () => {
    if (!itemForm.caseId || !itemForm.name.trim()) {
      setMessage('У скина должны быть кейс и название.');
      return;
    }

    const rarity = itemForm.isFake ? 'fake' : itemForm.rarity;
    const ok = await mutate(
      {
        action: 'saveItem',
        item: {
          id: itemForm.id,
          caseId: itemForm.caseId,
          name: itemForm.name.trim(),
          rarity,
          sellPrice: Number(itemForm.sellPrice) || 0,
          imageUrl: itemForm.imageUrl.trim() || null,
          dropChance: Number(itemForm.dropChance) || 0,
          isActive: itemForm.isActive,
          isFake: itemForm.isFake,
          sortOrder: Number(itemForm.sortOrder) || 0,
        },
      },
      itemForm.id ? 'Скин обновлён.' : 'Скин добавлен.',
    );

    if (ok) {
      setItemForm({ ...EMPTY_ITEM, caseId: itemForm.caseId });
    }
  };

  const removeItem = async (itemId: number) => {
    await mutate({ action: 'deleteItem', itemId }, 'Скин удалён.');
  };

  const applyBotItem = (item: BotInventoryItem) => {
    setItemForm((current) => ({
      ...current,
      name: item.name,
      sellPrice: String(item.price || 0),
      imageUrl: item.image || '',
      botSelection: item.name,
    }));
  };

  if (loading && !data) {
    return <p className={styles.hint}>Загрузка кейсов...</p>;
  }

  if (data && !data.databaseConfigured) {
    return (
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <h2>Кейсы</h2>
          <p>База данных недоступна, поэтому управление кейсами сейчас выключено.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div>
          <h2>Кейсы</h2>
          <p>Настройки, состав и статусы кейсов.</p>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void submitSettings(
              {
                casesEnabled: !(data?.settings.casesEnabled ?? true),
                adminOnlyOpen: data?.settings.adminOnlyOpen === true,
              },
              data?.settings.casesEnabled ? 'Кейсы выключены.' : 'Кейсы включены.',
            )}
            disabled={saving}
          >
            {data?.settings.casesEnabled ? 'Выключить все кейсы' : 'Включить все кейсы'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void submitSettings(
              {
                casesEnabled: data?.settings.casesEnabled !== false,
                adminOnlyOpen: !(data?.settings.adminOnlyOpen === true),
              },
              data?.settings.adminOnlyOpen ? 'Открытие кейсов снова доступно всем.' : 'Открытие кейсов теперь только для админов.',
            )}
            disabled={saving}
          >
            {data?.settings.adminOnlyOpen ? 'Открытие для всех' : 'Открытие только для админов'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={loading || saving}>
            Обновить
          </button>
        </div>
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}

      <div className={styles.systemRow}>
        <div className={`${styles.statusBadge} ${data?.settings.casesEnabled ? styles.statusOn : styles.statusOff}`}>
          {data?.settings.casesEnabled ? 'Система кейсов: включена' : 'Система кейсов: выключена'}
        </div>
        <div className={`${styles.statusBadge} ${data?.settings.adminOnlyOpen ? styles.statusOff : styles.statusOn}`}>
          {data?.settings.adminOnlyOpen ? 'Открытие: только админы' : 'Открытие: все игроки'}
        </div>
        <div className={`${styles.statusBadge} ${data?.botConfigured ? styles.statusOn : styles.statusOff}`}>
          {data?.botConfigured ? 'Бот: подключён' : 'Бот: не настроен'}
        </div>
        {data?.botError ? <div className={styles.warning}>{data.botError}</div> : null}
      </div>

      <div className={styles.layout}>
        <section className={`${styles.card} ${styles.sidebarCard}`}>
          <div className={styles.sectionHead}>
            <h3>Список кейсов</h3>
            <button type="button" className={styles.secondaryButton} onClick={() => { setCaseForm(EMPTY_CASE); setSelectedCaseId(''); setItemForm(EMPTY_ITEM); }}>
              Новый кейс
            </button>
          </div>
          <div className={styles.caseList}>
            {cases.map((caseDef) => (
              <article
                key={caseDef.id}
                className={`${styles.caseCard} ${selectedCaseId === caseDef.id ? styles.caseCardActive : ''}`}
                style={{ borderColor: caseDef.accent }}
              >
                <div className={styles.caseCardHead}>
                  <strong>{caseDef.name}</strong>
                  <span>{caseDef.id}</span>
                </div>
                <div className={styles.caseMeta}>
                  <span>{caseDef.price} RW</span>
                  <span className={caseDef.isActive ? styles.metaOn : styles.metaOff}>{caseDef.isActive ? 'Активен' : 'Выключен'}</span>
                  <span>{caseDef.items.length} скинов</span>
                </div>
                <div className={styles.inlineActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => openCaseEditor(caseDef)}>Редактировать</button>
                  <button type="button" className={styles.dangerButton} onClick={() => void removeCase(caseDef.id)}>Удалить</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3>{caseForm.id ? 'Редактирование кейса' : 'Новый кейс'}</h3>
          <div className={styles.formGrid}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>ID</span>
                <input value={caseForm.id} onChange={(e) => setCaseForm((current) => ({ ...current, id: e.target.value }))} placeholder="crimson" />
              </label>
              <label className={styles.field}>
                <span>Название</span>
                <input value={caseForm.name} onChange={(e) => setCaseForm((current) => ({ ...current, name: e.target.value }))} placeholder="Багровый" />
              </label>
            </div>
            <label className={styles.field}>
              <span>Описание кейса</span>
              <textarea value={caseForm.description} onChange={(e) => setCaseForm((current) => ({ ...current, description: e.target.value }))} />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Цена RW</span>
                <input type="number" value={caseForm.price} onChange={(e) => setCaseForm((current) => ({ ...current, price: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Акцент</span>
                <input value={caseForm.accent} onChange={(e) => setCaseForm((current) => ({ ...current, accent: e.target.value }))} placeholder="#ff4d4d" />
              </label>
            </div>
            <label className={styles.field}>
              <span>Картинка кейса</span>
              <input value={caseForm.imageUrl} onChange={(e) => setCaseForm((current) => ({ ...current, imageUrl: e.target.value }))} placeholder="/cases/example.png" />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={caseForm.isActive} onChange={(e) => setCaseForm((current) => ({ ...current, isActive: e.target.checked }))} />
              <span>Кейс активен</span>
            </label>
            <div className={styles.inlineActions}>
              <button type="button" className={styles.primaryButton} onClick={() => void submitCase()} disabled={saving}>
                Сохранить кейс
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setCaseForm(EMPTY_CASE)} disabled={saving}>
                Сбросить
              </button>
            </div>
          </div>
        </section>
      </div>

      {selectedCase ? (
        <div className={styles.layout}>
          <section className={`${styles.card} ${styles.sidebarCard}`}>
            <div className={styles.sectionHead}>
              <div>
                <h3>Скины кейса</h3>
                <p className={styles.hint}>{selectedCase.name}</p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setItemForm({ ...EMPTY_ITEM, caseId: selectedCase.id })}
              >
                Новый скин
              </button>
            </div>

            <div className={styles.itemTable}>
              {visibleItems.map((item) => {
                const rarityMeta = RARITY_OPTIONS.find((option) => option.value === (item.isFake ? 'fake' : item.rarity)) || RARITY_OPTIONS[0];

                return (
                  <div key={item.id} className={styles.itemRow}>
                    <div className={styles.itemMain}>
                      <strong>{item.name}</strong>
                    </div>
                    <div className={styles.itemMeta}>
                      <span style={{ color: rarityMeta.color }}>{rarityMeta.label}</span>
                      <span>{item.dropChance}% шанс</span>
                      <span>{item.sellPrice} RW</span>
                      <span>#{item.sortOrder}</span>
                      <span className={item.isActive ? styles.metaOn : styles.metaOff}>{item.isActive ? 'Активен' : 'Выкл'}</span>
                    </div>
                    <div className={styles.inlineActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => openItemEditor(item)}>Редактировать</button>
                      <button type="button" className={styles.dangerButton} onClick={() => void removeItem(item.id)}>Удалить</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.card}>
            <h3>{itemForm.id ? 'Редактирование скина' : 'Добавление скина'}</h3>
            <div className={styles.formGrid}>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Кейс</span>
                  <select value={itemForm.caseId} onChange={(e) => setItemForm((current) => ({ ...current, caseId: e.target.value }))}>
                    <option value="">Выбери кейс</option>
                    {cases.map((caseDef) => (
                      <option key={caseDef.id} value={caseDef.id}>{caseDef.name}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Инвентарь бота</span>
                  <select
                    value={itemForm.botSelection}
                    onChange={(e) => {
                      const next = e.target.value;
                      setItemForm((current) => ({ ...current, botSelection: next }));
                      const item = botItems.find((candidate) => candidate.name === next);
                      if (item) {
                        applyBotItem(item);
                      }
                    }}
                  >
                    <option value="">Выбери из бота</option>
                    {botItems.map((item) => (
                      <option key={item.name} value={item.name}>{item.name} ({item.count})</option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedBotItem ? <p className={styles.hint}>{selectedBotItem.name}</p> : null}

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Название</span>
                  <input value={itemForm.name} onChange={(e) => setItemForm((current) => ({ ...current, name: e.target.value }))} />
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Редкость</span>
                  <select
                    value={itemForm.isFake ? 'fake' : itemForm.rarity}
                    onChange={(e) => {
                      const rarity = e.target.value as CaseRarity;
                      setItemForm((current) => ({
                        ...current,
                        rarity,
                        isFake: rarity === 'fake',
                      }));
                    }}
                  >
                    {RARITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Шанс</span>
                  <input type="number" step="0.01" value={itemForm.dropChance} onChange={(e) => setItemForm((current) => ({ ...current, dropChance: e.target.value }))} placeholder="Например 7.5" />
                </label>
                <label className={styles.field}>
                  <span>Порядок</span>
                  <input type="number" value={itemForm.sortOrder} onChange={(e) => setItemForm((current) => ({ ...current, sortOrder: e.target.value }))} />
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Цена RW</span>
                  <input type="number" value={itemForm.sellPrice} onChange={(e) => setItemForm((current) => ({ ...current, sellPrice: e.target.value }))} />
                </label>
                <label className={styles.field}>
                  <span>Картинка</span>
                  <input value={itemForm.imageUrl} onChange={(e) => setItemForm((current) => ({ ...current, imageUrl: e.target.value }))} />
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={itemForm.isActive} onChange={(e) => setItemForm((current) => ({ ...current, isActive: e.target.checked }))} />
                  <span>Скин активен</span>
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={itemForm.isFake}
                    onChange={(e) => setItemForm((current) => ({
                      ...current,
                      isFake: e.target.checked,
                      rarity: e.target.checked ? 'fake' : (current.rarity === 'fake' ? 'common' : current.rarity),
                    }))}
                  />
                  <span>Фейк-скин</span>
                </label>
              </div>

              <div className={styles.inlineActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void submitItem()} disabled={saving}>
                  Сохранить скин
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setItemForm({ ...EMPTY_ITEM, caseId: selectedCase.id })}
                  disabled={saving}
                >
                  Сбросить
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
