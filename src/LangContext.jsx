import { createContext, useContext, useState } from 'react'
import { getT, LANGUAGES } from './i18n'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('dhs_lang') || 'nl')

  const setLang = (code) => {
    setLangState(code)
    localStorage.setItem('dhs_lang', code)
  }

  const t = getT(lang)

  return (
    <LangContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => {
  const ctx = useContext(LangContext)
  // Graceful fallback when used outside LangProvider (e.g. standalone admin shell)
  if (!ctx) {
    const t = getT('nl')
    return { lang: 'nl', setLang: () => {}, t, LANGUAGES }
  }
  return ctx
}
