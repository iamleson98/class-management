'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import vi from './locales/vi'
import en from './locales/en'

type Locale = 'vi' | 'en'
type TranslationValue = string

// Flatten the translation object to Record<string, string>
type Translations = Record<string, TranslationValue>

const translations: Record<Locale, Translations> = { vi, en }

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string, args?: Record<string, any>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'vi',
  setLocale: () => {},
  t: (key: string, fallback?: string, args?: Record<string, any>) => fallback ?? key,
})

const STORAGE_KEY = 'vmg-lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi')

  // Read persisted language on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'vi') {
        setLocaleState(stored)
      }
    } catch {
      // localStorage not available (SSR)
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // localStorage not available
    }
  }, [])

  // Resolve a translation string, optionally substituting {placeholder} tokens
  // with values from `args`. Unknown tokens are left untouched.
  const resolve = useCallback(
    (template: string, args?: Record<string, any>): string => {
      if (!args) return template
      return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in args ? String(args[key]) : match
      )
    },
    []
  )

  const t = useCallback(
    (key: string, fallback?: string, args?: Record<string, any>): string => {
      const template =
        translations[locale][key] ?? translations['vi'][key] ?? fallback ?? key
      return resolve(template, args)
    },
    [locale, resolve]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    // Fallback for SSR or outside provider
    const t = (key: string, fallback?: string, args?: Record<string, any>): string => {
      const template = vi[key as keyof typeof vi] ?? fallback ?? key
      if (!args) return template
      return template.replace(/\{(\w+)\}/g, (match, k: string) =>
        k in args ? String(args[k]) : match
      )
    }
    return { locale: 'vi' as Locale, setLocale: (_l: Locale) => {}, t }
  }
  return context
}

export type { Locale }
