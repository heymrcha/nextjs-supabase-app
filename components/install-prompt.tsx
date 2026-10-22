"use client";

import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "native" | "ios";

const DISMISS_KEY = "moim:install-dismissed";

// 브라우저는 beforeinstallprompt를 한 번만 쏘므로 컴포넌트가 마운트되기 전에 놓치지 않도록
// 모듈 스코프에 보관하고 useSyncExternalStore로 구독한다
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let dismissed: boolean | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function readDismissed(): boolean {
  if (dismissed === null) {
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // 사생활 보호 모드 등에서 저장소 접근이 막힌 경우 — 이번 방문에만 기억한다
      dismissed = false;
    }
  }
  return dismissed;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // 기본 미니 인포바를 막고 우리 배너로 대신한다
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 Safari로 위장하므로 터치 지원 여부로 구분한다
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // 카카오톡 인앱 브라우저에는 "홈 화면에 추가"가 없어 안내해도 따라 할 수 없다
  return isIos && !/KAKAOTALK/i.test(ua);
}

function getSnapshot(): Mode {
  if (readDismissed() || isStandalone()) return "hidden";
  if (deferredPrompt) return "native";
  return isIosSafari() ? "ios" : "hidden";
}

function dismiss() {
  dismissed = true;
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // 저장 실패는 무시한다 — 다음 방문에 배너가 다시 보일 뿐이다
  }
  emit();
}

async function install() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  // 한 번 쓴 프롬프트는 재사용할 수 없다
  deferredPrompt = null;
  emit();
}

export function InstallPrompt() {
  const mode = useSyncExternalStore<Mode>(
    subscribe,
    getSnapshot,
    () => "hidden",
  );

  if (mode === "hidden") return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-secondary/40 p-4">
      <span aria-hidden className="text-3xl">
        📲
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">홈 화면에 모임을 추가하세요</p>
        <p className="text-xs text-muted-foreground">
          {mode === "native"
            ? "앱처럼 바로 열고, 모임을 더 빨리 확인할 수 있습니다."
            : "Safari 하단의 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요."}
        </p>
      </div>
      {mode === "native" && (
        <Button size="sm" onClick={install}>
          <Download aria-hidden />
          설치
        </Button>
      )}
      {/* 터치 영역 44px 확보(T-603) */}
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        onClick={dismiss}
        aria-label="설치 안내 닫기"
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
