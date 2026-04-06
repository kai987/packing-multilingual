import type {
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from 'react'
import {
  localeNames,
  supportedLocales,
  type SupportedLocale,
} from '../locale'

type FloatingRepoLinkProps = {
  href: string
  ariaLabel: string
}

export function FloatingRepoLink({
  href,
  ariaLabel,
}: FloatingRepoLinkProps) {
  return (
    <a
      className="repo-link-wrap"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="repo-link" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 0C5.37 0 0 5.49 0 12.26c0 5.42 3.44 10.01 8.2 11.64.6.12.82-.27.82-.59 0-.29-.01-1.08-.02-2.12-3.34.75-4.05-1.66-4.05-1.66-.55-1.42-1.34-1.79-1.34-1.79-1.09-.77.08-.75.08-.75 1.21.09 1.85 1.28 1.85 1.28 1.07 1.89 2.82 1.34 3.5 1.02.11-.8.42-1.34.76-1.65-2.67-.31-5.47-1.37-5.47-6.1 0-1.35.47-2.45 1.24-3.32-.13-.31-.54-1.57.12-3.27 0 0 1.01-.33 3.3 1.27a11.22 11.22 0 0 1 6.01 0c2.29-1.6 3.29-1.27 3.29-1.27.66 1.7.25 2.96.12 3.27.77.87 1.24 1.97 1.24 3.32 0 4.74-2.81 5.78-5.49 6.08.43.38.82 1.12.82 2.26 0 1.64-.01 2.96-.01 3.36 0 .33.21.72.82.59C20.57 22.27 24 17.68 24 12.26 24 5.49 18.63 0 12 0Z" />
        </svg>
      </span>
    </a>
  )
}

type LanguageSwitcherProps = {
  locale: SupportedLocale
  isOpen: boolean
  menuRef: RefObject<HTMLDivElement | null>
  label: string
  ariaLabel: string
  onTogglePointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onToggleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onOptionPointerDown: (
    locale: SupportedLocale,
  ) => (event: PointerEvent<HTMLButtonElement>) => void
  onOptionKeyDown: (
    locale: SupportedLocale,
  ) => (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function LanguageSwitcher({
  locale,
  isOpen,
  menuRef,
  label,
  ariaLabel,
  onTogglePointerDown,
  onToggleKeyDown,
  onOptionPointerDown,
  onOptionKeyDown,
}: LanguageSwitcherProps) {
  return (
    <div
      className={isOpen ? 'language-switch-wrap is-open' : 'language-switch-wrap'}
      ref={menuRef}
    >
      <button
        type="button"
        className={isOpen ? 'language-switch is-open' : 'language-switch'}
        onPointerDown={onTogglePointerDown}
        onKeyDown={onToggleKeyDown}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="language-switch-copy">
          <strong>{localeNames[locale]}</strong>
          <small>{label}</small>
        </span>
        <span className="language-switch-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div
        className={isOpen ? 'language-switch-menu is-open' : 'language-switch-menu'}
        role="menu"
        aria-label={label}
        aria-hidden={!isOpen}
      >
        {supportedLocales.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={option === locale}
            tabIndex={isOpen ? 0 : -1}
            className={
              option === locale
                ? 'language-switch-option is-active'
                : 'language-switch-option'
            }
            onPointerDown={onOptionPointerDown(option)}
            onKeyDown={onOptionKeyDown(option)}
          >
            <span>{localeNames[option]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
