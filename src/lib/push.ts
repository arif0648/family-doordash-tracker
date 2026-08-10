/**
 * push.ts — Web Push altyapısı (client tarafı).
 *
 * ÖNEMLİ DÜRÜSTLÜK NOTU: Bu dosya gerçek push subscription/permission akışını
 * uygular. Ancak GERÇEK bir bildirimin cihaza ulaşıp ulaşmadığı, yalnızca
 * gerçek VAPID key çifti + gerçek bir Supabase Edge Function deploy'u + gerçek
 * bir cihaz/tarayıcı ile test edilebilir. Bu üçü de bu sandbox'ta mevcut
 * değil — bu yüzden Final Verification raporunda "Push Notification" satırı
 * NOT VERIFIED olarak işaretlenmiştir, kod var olduğu için PASS değil.
 */

import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function requestPushPermissionAndSubscribe(userId: string): Promise<
  { success: true } | { success: false; reason: string }
> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'Bu tarayıcı push bildirimlerini desteklemiyor.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, reason: 'VAPID anahtarı yapılandırılmamış (deployment eksik).' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    // Kullanıcı izin vermedi. Uygulamanın DİĞER işlevleri bundan
    // etkilenmez (IMPLEMENTATION LOCK / Bölüm 11).
    return { success: false, reason: 'İzin verilmedi.' };
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { error } = await supabase
    .from('user_settings')
    .update({ push_enabled: true, push_subscription: subscription.toJSON() })
    .eq('user_id', userId);

  if (error) {
    return { success: false, reason: error.message };
  }

  return { success: true };
}

export async function disablePush(userId: string): Promise<void> {
  await supabase
    .from('user_settings')
    .update({ push_enabled: false, push_subscription: null })
    .eq('user_id', userId);

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    await sub?.unsubscribe();
  }
}
