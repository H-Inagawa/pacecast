export function canUseGeolocation(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation) && window.isSecureContext;
}

export type GeoPosition = {
  latitude: number;
  longitude: number;
};

export function geolocationUnavailableReason(): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "位置情報は HTTPS か http://127.0.0.1 で使えます";
  }
  return "このブラウザでは位置情報を使えません";
}

export function readGeolocationError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = Number((error as GeolocationPositionError).code);
    if (code === 1) {
      return "位置情報の利用が許可されていません";
    }
    if (code === 2) {
      return "現在地を取得できませんでした";
    }
    if (code === 3) {
      return "現在地の取得がタイムアウトしました";
    }
  }
  return "現在地を取得できませんでした";
}

export function requestCurrentPosition(): Promise<GeoPosition> {
  if (!canUseGeolocation()) {
    return Promise.reject(new Error(geolocationUnavailableReason()));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(readGeolocationError(error)));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
