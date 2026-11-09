import type { Metadata } from "next";
import { Geist, Literata } from "next/font/google";
import { connection } from "next/server";
import { AppHeader } from "@/components/app-header";
import { AppTour } from "@/components/app-tour";
import { ProfileProvider } from "@/components/profile-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";
import { getProgramme } from "@/lib/grammar-programme";
import { getProfile, hasSavedProfile, isExamGoal, targetLanguage } from "@/lib/profile";
import { tourSteps } from "@/lib/tour-steps";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const serif = Literata({ subsets: ["latin"], variable: "--font-article" });

export const metadata: Metadata = {
  title: "Learnee",
  description: "Entraînement quotidien en langue étrangère : écrit, grammaire, écoute et vocabulaire, selon ton objectif.",
};

// Visite guidée pour tout utilisateur connecté (elle se lance seule au premier passage sur l'accueil),
// une fois l'objectif choisi : pas pendant l'écran « Ton objectif ».
async function Tour() {
  const user = await getCurrentUser();
  if (!user || !hasSavedProfile()) return null;
  const profile = getProfile();
  const steps = tourSteps({
    nameFr: targetLanguage(profile).nameFr,
    bts: profile.goal.preset === "bts-com",
    exam: isExamGoal(profile),
    points: getProgramme(profile).points.length,
  });
  return <AppTour login={user.login} steps={steps} />;
}

// Langue étudiée pour les composants client ; lue à la requête (la base n'est pas lue pendant le build).
async function Language({ children }: { children: React.ReactNode }) {
  await connection();
  return <ProfileProvider language={targetLanguage()}>{children}</ProfileProvider>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <Language>
            <AppHeader />
            <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>
            <Tour />
          </Language>
        </ThemeProvider>
      </body>
    </html>
  );
}
