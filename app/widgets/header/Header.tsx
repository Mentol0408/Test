"use client"

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from './Header.module.scss'
import Link from "next/link";
import { usePathname } from "next/navigation";
import PaymentMethodModal from '@/shared/ui/PaymentMethodModal/PaymentMethodModal';

import {
    BALANCE_UPDATED_EVENT,
    isBalanceUpdatedEvent,
    type BalanceUpdatedDetail,
} from '@/lib/balanceEvents';
import {
    BALANCE_TOPUP,
    PAYMENT_PROVIDERS,
    type PaymentProvider,
} from '@/lib/paymentConfig';
import type { BalanceSummaryResponse } from '@/types/balance';

type HeaderProps = {
    onHallOfFameOpen?: () => void;
}

const AUTH_REQUIRED_MESSAGE = 'Авторизируйтесь через Steam';
const BALANCE_DATABASE_MESSAGE = 'Баланс временно недоступен. Проверьте подключение базы данных.';
const FALLBACK_ERROR_MESSAGE = 'Не удалось создать платёж. Попробуйте ещё раз.';

function formatCurrency(value: number) {
    return `${value}₽`;
}

export default function Header({ onHallOfFameOpen }: HeaderProps) {
    const rootRef = useRef<HTMLElement | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [balance, setBalance] = useState<number>(0);
    const [isBalanceAvailable, setIsBalanceAvailable] = useState<boolean>(true);
    const [isBalanceLoaded, setIsBalanceLoaded] = useState<boolean>(false);
    const [topupAmount, setTopupAmount] = useState<number>(BALANCE_TOPUP.defaultAmount);
    const [isTopupModalOpen, setIsTopupModalOpen] = useState<boolean>(false);
    const [isTopupLoading, setIsTopupLoading] = useState<boolean>(false);
    const [modalMessage, setModalMessage] = useState<string>('');
    const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

    const handleLogin = () => {
        const returnTo = encodeURIComponent(window.location.href);
        window.location.href = `/api/steam/login?returnTo=${returnTo}`;
    };

    const handleLogout = async () => {
        await fetch("/api/logout", { method: "POST" });
        setAvatarUrl(null);
        setBalance(0);
        setIsBalanceAvailable(true);
        setIsBalanceLoaded(false);
        setIsTopupModalOpen(false);
        setModalMessage('');
        setIsUserMenuOpen(false);
        window.location.href = "/";
    };

    const getTopupLabel = () => `Пополнение баланса на ${formatCurrency(topupAmount)}`;

    const openTopupModal = () => {
        if (!isAuthenticated) {
            return;
        }

        setModalMessage(isBalanceAvailable ? '' : BALANCE_DATABASE_MESSAGE);
        setIsUserMenuOpen(false);
        setIsTopupModalOpen(true);
    };

    const closeTopupModal = () => {
        if (isTopupLoading) {
            return;
        }

        setIsTopupModalOpen(false);
        setModalMessage('');
    };

    const handleTopup = async (provider: PaymentProvider) => {
        if (!isAuthenticated) {
            setModalMessage(AUTH_REQUIRED_MESSAGE);
            return;
        }

        if (!isBalanceAvailable) {
            setModalMessage(BALANCE_DATABASE_MESSAGE);
            return;
        }

        const endpoint = provider === 'enot' ? '/api/enot/create-payment' : '/api/tbank/create-payment';

        setIsTopupLoading(true);
        setModalMessage('');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paymentType: 'balance_topup', amount: topupAmount }),
            });

            const data = await response.json().catch(() => null);

            if (response.status === 401) {
                setModalMessage(AUTH_REQUIRED_MESSAGE);
                return;
            }

            if (!response.ok || !data?.ok || !data?.url) {
                const message = data?.error === 'DIRECT_PAYMENT_DISABLED'
                    ? 'Прямая покупка товаров отключена. Сначала пополните баланс.'
                    : data?.error === 'ENOT_NOT_CONFIGURED' || data?.error === 'TBANK_NOT_CONFIGURED' || data?.error === 'ENOT_WEBHOOK_SECRET_NOT_CONFIGURED'
                        ? 'Эта платёжная система ещё не настроена для пополнения баланса.'
                        : data?.error || FALLBACK_ERROR_MESSAGE;

                setModalMessage(message);
                return;
            }

            window.location.href = data.url;
        } catch {
            setModalMessage(FALLBACK_ERROR_MESSAGE);
        } finally {
            setIsTopupLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const applyBalanceState = (detail: BalanceUpdatedDetail) => {
            if (!mounted) {
                return;
            }

            if (!detail.isAuthenticated) {
                setBalance(0);
                setIsBalanceAvailable(true);
                setIsBalanceLoaded(false);
                return;
            }

            setBalance(detail.databaseConfigured ? detail.balance : 0);
            setIsBalanceAvailable(detail.databaseConfigured);
            setIsBalanceLoaded(true);
        };

        const loadBalance = async () => {
            try {
                const response = await fetch('/api/balance', { credentials: 'include', cache: 'no-store' });
                const data = (await response.json().catch(() => null)) as BalanceSummaryResponse | null;

                if (!mounted || !data?.ok) {
                    return;
                }

                applyBalanceState({
                    balance: data.balance ?? 0,
                    isAuthenticated: Boolean(data.isAuthenticated),
                    databaseConfigured: data.databaseConfigured !== false,
                });
            } catch {
                if (mounted) {
                    setBalance(0);
                    setIsBalanceAvailable(false);
                    setIsBalanceLoaded(true);
                }
            }
        };

        const handleBalanceUpdated = (event: Event) => {
            if (!isBalanceUpdatedEvent(event)) {
                return;
            }

            applyBalanceState(event.detail);
        };

        window.addEventListener(BALANCE_UPDATED_EVENT, handleBalanceUpdated);

        fetch('/api/session', { credentials: 'include', cache: 'no-store' })
            .then(r => {
                if (r.status === 200) return r.json();
                return Promise.resolve(null);
            })
            .then(data => {
                if (data?.steamId) {
                    setIsAuthenticated(true);
                    setIsAdmin(Boolean(data?.isAdmin));
                    void loadBalance();
                    fetch('/api/steam/avatar', { credentials: 'include', cache: 'no-store' })
                        .then(r => r.ok ? r.json() : null)
                        .then(j => {
                            if (mounted && j?.avatar) setAvatarUrl(j.avatar);
                        })
                        .catch(() => { });
                } else {
                    setIsAuthenticated(false);
                    setIsAdmin(false);
                    setBalance(0);
                    setIsBalanceAvailable(true);
                    setIsBalanceLoaded(false);
                }
            })
            .catch(() => {
                setIsAuthenticated(false);
                setIsAdmin(false);
                setBalance(0);
                setIsBalanceAvailable(false);
                setIsBalanceLoaded(false);
            });

        return () => {
            mounted = false;
            window.removeEventListener(BALANCE_UPDATED_EVENT, handleBalanceUpdated);
        };
    }, []);

    useEffect(() => {
        if (!isUserMenuOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isUserMenuOpen]);

    const pathname = usePathname();
    // На главной — плавный скролл к секции (#id), на других страницах — переход на главную (/#id).
    const sectionHref = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`);

    return (
        <>
            <header ref={rootRef} className={styles.header}>
                <div className={styles.general}>
                    <Link href="/" aria-label="На главную" className={styles.logoLink}>
                        <Image className={styles.logo} src="/logo.svg" alt="Rust Way Logo" width={150} height={20} />
                    </Link>
                    <ul className={styles.nav}>
                        <li>
                            <Link href="/store">Магазин</Link>
                        </li>
                        <li>
                            <a href={sectionHref('advantages')}>Почему мы?</a>
                        </li>
                        <li>
                            <a href={sectionHref('servers')}>Сервера</a>
                        </li>
                        <li>
                            <a
                                className={styles.fameLink}
                                href={sectionHref('hall-of-fame')}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onHallOfFameOpen?.();
                                }}
                            >
                                Зал славы
                            </a>
                        </li>
                        <li>
                            <a href={sectionHref('community')}>Комьюнити</a>
                        </li>
                    </ul>
                </div>
                <div className={styles.actions}>
                    <ul className={styles.community}>
                        <li>
                            <Link href="https://www.youtube.com/@RustWayServers" target="_blank" rel="noopener noreferrer">
                                <Image src="/youtube-icon.svg" alt="YouTube" width={29} height={20} />
                            </Link>
                        </li>
                        <li>
                            <Link href="https://discord.com/invite/rustway" target="_blank" rel="noopener noreferrer">
                                <Image src="/discord-icon.svg" alt="Discord" width={29} height={20} />
                            </Link>
                        </li>
                        <li>
                            <Link href="https://t.me/Hardwayrust" target="_blank" rel="noopener noreferrer">
                                <Image src="/telegram-icon.svg" alt="Telegram" width={20} height={20} />
                            </Link>
                        </li>
                        <li>
                            <Link href="https://www.tiktok.com/@rustway_official" target="_blank" rel="noopener noreferrer">
                                <Image src="/tiktok-icon.svg" alt="TikTok" width={18} height={20} />
                            </Link>
                        </li>
                        <li>
                            <Link href="https://vk.com/rustway?from=groups" target="_blank" rel="noopener noreferrer">
                                <Image src="/vk-icon.svg" alt="VK" width={20} height={20} />
                            </Link>
                        </li>
                    </ul>
                    <button type="button" className={styles.fameAction} onClick={onHallOfFameOpen}>
                        Зал славы
                    </button>
                    {!isAuthenticated ? (
                        <Link href="/support" className={styles.supportLink}>
                            Тикеты
                        </Link>
                    ) : null}
                    {isAuthenticated ? (
                        <div className={styles.userControls}>
                            <button
                                type="button"
                                className={`${styles.avatarButton} ${isUserMenuOpen ? styles.avatarButtonActive : ''}`}
                                onClick={() => setIsUserMenuOpen((current) => !current)}
                                aria-label="Открыть меню игрока"
                                aria-expanded={isUserMenuOpen}
                            >
                                {avatarUrl ? (
                                    <Image src={avatarUrl} alt="Avatar" className={styles.avatar} width={50} height={50} />
                                ) : (
                                    <span className={styles.avatarFallback} />
                                )}
                                <span className={styles.avatarChevron} aria-hidden="true" />
                            </button>
                            {isUserMenuOpen ? (
                                <div className={styles.userMenu}>
                                    <div className={styles.userMenuHeader}>
                                        <span>Личный кабинет</span>
                                        <strong>{isBalanceLoaded ? formatCurrency(balance) : '...'}</strong>
                                        <small>{isBalanceAvailable ? 'Текущий баланс аккаунта' : 'Баланс временно недоступен'}</small>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.userMenuPrimary}
                                        onClick={openTopupModal}
                                        disabled={isTopupLoading || !isBalanceLoaded}
                                    >
                                        <span>+</span>
                                        Пополнить баланс
                                    </button>
                                    <div className={styles.userMenuLinks}>
                                        <Link href="/support" onClick={() => setIsUserMenuOpen(false)}>
                                            <span>?</span>
                                            Тикеты и поддержка
                                        </Link>
                                        {isAdmin ? (
                                            <Link href="/admin" onClick={() => setIsUserMenuOpen(false)}>
                                                <span>⚙</span>
                                                Админка
                                            </Link>
                                        ) : null}
                                        <button type="button" onClick={async () => { await handleLogout(); }}>
                                            <span>↪</span>
                                            Выйти из аккаунта
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <button onClick={handleLogin} className={styles.button}>Войти</button>
                    )}
                </div>
            </header>
            <PaymentMethodModal
                isOpen={isTopupModalOpen}
                onClose={closeTopupModal}
                title={'Пополнение баланса'}
                subtitle={getTopupLabel()}
                disabled={isTopupLoading}
                providers={PAYMENT_PROVIDERS}
                onSelect={(provider) => {
                    void handleTopup(provider);
                }}
                message={modalMessage}
            >
                <div className={styles.topupModalControls}>
                    <div className={styles.topupModalHeader}>
                        <p>Сумма пополнения</p>
                        <strong>{formatCurrency(topupAmount)}</strong>
                    </div>
                    <input
                        type="range"
                        min={BALANCE_TOPUP.min}
                        max={BALANCE_TOPUP.max}
                        step={BALANCE_TOPUP.step}
                        value={topupAmount}
                        onChange={(event) => setTopupAmount(Number(event.target.value))}
                        className={styles.topupSlider}
                        style={{ "--progress": `${((topupAmount - BALANCE_TOPUP.min) / (BALANCE_TOPUP.max - BALANCE_TOPUP.min)) * 100}%` } as React.CSSProperties}
                    />
                    <p className={styles.topupModalHint}>Выберите сумму, затем укажите платёжный способ ниже.</p>
                </div>
            </PaymentMethodModal>
        </>
    );
}

