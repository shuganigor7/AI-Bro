'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Lang, Translations } from './i18n'

type LanguageContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  tr: Translations
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ru',
  setLang: () => {},
  tr: translations.ru,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => {
    const saved = localStorage.getItem('aibro_lang') as Lang | null
    if (saved === 'ru' || saved === 'en') setLangState(saved)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('aibro_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, tr: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
