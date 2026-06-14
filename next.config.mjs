import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15 會自動推斷 workspace root 給 output file tracing 用;本機家目錄
  // (/Users/marcus)有一個無關的 package-lock.json,會被誤判成 root。明確把
  // root 釘在專案目錄,避免 file tracing 從錯誤根目錄收集檔案、並消除 build
  // 警告。(此鍵在 14 為 experimental.outputFileTracingRoot,15 已轉正。)
  outputFileTracingRoot: projectRoot,
  experimental: {
    // Perf Tier 1 — client Router Cache TTL. Next 15 defaults dynamic:0, so every
    // back/forward + sidebar revisit to a dynamic (cookie-auth) route refetched
    // the RSC payload ("切換頁面又重讀一下" 的主因). 15s 是保守值:快速重訪/上下頁
    // 變瞬間(快取命中、零伺服器往返),過期窗只影響被動的讀取導航;所有 mutation
    // 都已 revalidatePath(寫入會即時清快取),故寫後資料仍即時。
    staleTimes: {
      dynamic: 15,
      static: 300,
    },
  },
}

export default nextConfig
