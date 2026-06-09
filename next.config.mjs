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
}

export default nextConfig
