/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Brain, Loader2 } from "lucide-react";
import { getFirebaseAuth } from "./lib/firebase-client";
import { translations } from "@/src/translations";
import PlanowanieView from "@/src/features/planowanie/PlanowanieView";
import HomeView from "@/src/features/home/HomeView";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";
import { CardRail } from "@/src/features/cards/CardRail";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";
import { buildCardCommands } from "@/src/features/cards/cards";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

export interface User {
  id: string;
  email: string;
  name: string;
}

function firebaseUserToAppUser(fbUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): User {
  return {
    id: fbUser.uid,
    email: fbUser.email ?? "",
    name: fbUser.displayName ?? fbUser.email ?? "User",
  };
}

export interface AppProps {
  /** When true, skip login screen (used under protected layout). */
  authenticated?: boolean;
}

export default function App({ authenticated = false }: AppProps = {}) {
  const [lang, setLang] = useState<"en" | "pl">("pl");
  const t = translations[lang];
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const { appMode, setAppMode, planningTab, setPlanningTab, placeholder, activeCard, selectCard } =
    useCardNavigation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const cardCommands = useMemo(() => buildCardCommands(selectCard), [selectCard]);
  useCardHotkeys({ onSelectCard: selectCard, onOpenPalette: openPalette, disabled: paletteOpen });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [checkingWaitlist, setCheckingWaitlist] = useState(false);

  const WAITLIST_ERROR_MSG =
    "Dostęp tylko dla osób z listy oczekujących. Dołącz do listy na stronie głównej.";

  const checkWaitlistAndProceed = async () => {
    setCheckingWaitlist(true);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setAuthError("Nie udało się pobrać tokenu.");
        return;
      }
      const res = await fetch("/api/waitlist/check", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        await signOut(auth);
        setAuthError(WAITLIST_ERROR_MSG);
        return;
      }
      if (!res.ok) {
        setAuthError("Błąd sprawdzania dostępu.");
        return;
      }
      // User stays logged in; onAuthStateChanged already set user, UI will show app
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Błąd połączenia.");
    } finally {
      setCheckingWaitlist(false);
    }
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? firebaseUserToAppUser(fbUser) : null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
      await checkWaitlistAndProceed();
    } catch (err: unknown) {
      console.error("Google login failed", err);
      setAuthError(err instanceof Error ? err.message : "Google sign-in failed");
      setCheckingWaitlist(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const auth = getFirebaseAuth();
    try {
      if (authMode === "register") {
        const checkRes = await fetch(
          `/api/waitlist/check-email?email=${encodeURIComponent(email.trim())}`
        );
        const checkData = await checkRes.json().catch(() => ({}));
        if (!checkRes.ok || checkData.allowed !== true) {
          setAuthError(WAITLIST_ERROR_MSG);
          return;
        }
      }
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name?.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      }
      await checkWaitlistAndProceed();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
      setCheckingWaitlist(false);
    }
  };

  const handleLogout = () => {
    signOut(getFirebaseAuth());
  };

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const auth = getFirebaseAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 403) {
      await signOut(auth);
      window.location.href = "/auth/login";
      return res;
    }
    return res;
  }, []);

  if (authLoading && !authenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[var(--text)] animate-spin" />
      </div>
    );
  }

  if (!authenticated && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--surface)] rounded-3xl shadow-[var(--shadow)] border border-[var(--border)] overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center">
                <Brain className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight text-[var(--text)]">Nexus</h1>
                <p className="text-xs text-[var(--text2)] font-medium uppercase tracking-wider">
                  Freelancer Edition
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-[var(--text)]">
              {authMode === "login" ? t.login : t.register}
            </h2>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "register" && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--accent)] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--accent)] transition-all"
                  required
                />
              </div>
              {authError && <p className="text-xs text-red-500 font-medium">{authError}</p>}
              <button
                type="submit"
                disabled={checkingWaitlist}
                className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {checkingWaitlist
                  ? "Sprawdzanie dostępu…"
                  : authMode === "login"
                    ? t.login
                    : t.register}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--surface)] px-2 text-[var(--text3)] font-bold">Or</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={checkingWaitlist}
              className="w-full flex items-center justify-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text2)] hover:bg-[var(--bg2)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t.signInGoogle}
            </button>

            <p className="text-center mt-8 text-sm text-[var(--text2)]">
              {authMode === "login" ? t.noAccount : t.hasAccount}{" "}
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="font-bold text-[var(--text)] hover:underline"
              >
                {authMode === "login" ? t.register : t.login}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden"
      data-card={activeCard}
    >
      <CardRail activeCard={activeCard} onSelect={selectCard} onOpenPalette={openPalette} />
      {placeholder ? (
        <CardPlaceholder cardId={placeholder} />
      ) : appMode === "home" ? (
        <HomeView
          user={user}
          apiFetch={apiFetch}
          lang={lang}
          t={t}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          appMode={appMode}
          setAppMode={setAppMode}
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
          onLogout={handleLogout}
          setLang={setLang}
        />
      ) : (
        <PlanowanieView
          user={user}
          apiFetch={apiFetch}
          lang={lang}
          t={t}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          appMode={appMode}
          setAppMode={setAppMode}
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
          onLogout={handleLogout}
          setLang={setLang}
        />
      )}
      <MobileNav
        appMode={appMode}
        setAppMode={setAppMode}
        planningTab={planningTab}
        setPlanningTab={setPlanningTab}
        lang={lang}
        onMoreOpen={() => setMoreDrawerOpen(true)}
      />
      <MobileMoreDrawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        onLogout={handleLogout}
        lang={lang}
        onSelectTab={(tab) => {
          setPlanningTab(tab);
          setAppMode("planowanie");
          setMoreDrawerOpen(false);
        }}
      />
      {paletteOpen && <CommandPalette commands={cardCommands} onClose={closePalette} />}
    </div>
  );
}
