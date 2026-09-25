// frontend/lib/apiClient.ts

export async function safeFetch<T>(
  url: string, 
  options: RequestInit = {}
): Promise<{ data: T | null; isOffline: boolean }> {
  const cacheKey = `schoolos_cache_${url.replace(/https?:\/\/[^/]+/, "")}`;

  try {
    // 🚀 Network First: সবসময় ফ্রেশ ডেটা আগে আনবে
    const res = await fetch(url, {
      ...options,
      cache: "no-store", // ব্রাউজার ক্যাশ বাইপাস করতে
      headers: {
        ...options.headers,
        "Cache-Control": "no-cache",
      }
    });

    if (res.ok) {
      const freshData = await res.json();
      
      // শুধুমাত্র GET রিকোয়েস্ট লোকাল স্টোরেজে ব্যাকআপ হিসেবে আপডেট করব
      if (!options.method || options.method.toUpperCase() === "GET") {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(freshData));
        } catch (e) {
          // Ignore quota errors
        }
      }
      return { data: freshData, isOffline: false };
    }
    
    throw new Error(`HTTP_${res.status}`);
  } catch (err) {
    // নেটওয়ার্ক ফেইল করলে বা অফলাইন হলে তখন ক্যাশ থেকে ডেটা দেবে
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return { data: JSON.parse(cached) as T, isOffline: true };
        } catch (e) {
          // Parsing error fallback
        }
      }
    }
    
    return { data: null, isOffline: true };
  }
}