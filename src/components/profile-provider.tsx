"use client";
import { createContext, useContext } from "react";
import type { TargetLanguage } from "@/lib/profile";

// Anglais par défaut : un composant rendu hors du layout (tests) garde le comportement d'avant.
const TargetLanguageContext = createContext<TargetLanguage>({ code: "en", name: "English", nameFr: "anglais", bcp47: "en-GB" });

/** Langue étudiée, lue sur le serveur (getProfile) et transmise aux composants client. */
export function ProfileProvider({ language, children }: { language: TargetLanguage; children: React.ReactNode }) {
  return <TargetLanguageContext.Provider value={language}>{children}</TargetLanguageContext.Provider>;
}

export const useTargetLanguage = () => useContext(TargetLanguageContext);
