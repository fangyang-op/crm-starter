import 'server-only'

/**
 * 上傳檔案內容嗅探(Stage 2-B / 資安 §2.5)。
 *
 * 問題:`file.type`(MIME)由 client 提供、可偽造(把 .exe 改名為 .pdf 並宣告
 * application/pdf 即可騙過純 MIME 檢查)。因此在寫入 Storage 之前,於 server
 * action 內以「實際位元組(magic number)」判定真實型別,只放行白名單。
 *
 * 用 `file-type` 套件做 magic-number 偵測。file-type v22 為純 ESM,故以動態
 * import 載入,確保在 Next.js server 環境(server action / server component)
 * 都能正常解析。本檔以 `import 'server-only'` 鎖定,不會進 client bundle。
 */

export type AllowedKind = 'pdf' | 'png' | 'jpeg' | 'webp'

const KIND_TO_MIME: Record<AllowedKind, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export type SniffResult = { ok: true; mime: string; ext: string } | { ok: false; error: string }

const MB = 1024 * 1024

/**
 * 驗證一個上傳檔案:
 *   1. 必須是非空 File。
 *   2. 大小不得超過 `maxBytes`。
 *   3. 以 magic number 嗅探真實型別,必須落在 `allowed` 白名單(嗅探為最終
 *      權威;client 宣告的 MIME 僅作便宜的第一道關卡,於各 action 內先擋)。
 *
 * 回傳偵測到的「真實 mime」,呼叫端應以此當作 Storage 的 contentType,而非
 * 信任 client 宣告的 file.type。偵測不到型別或不在白名單 → 一律拒絕。
 */
export async function sniffUploadedFile(
  file: unknown,
  opts: { allowed: AllowedKind[]; maxBytes: number },
): Promise<SniffResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '請選擇檔案' }
  }
  if (file.size > opts.maxBytes) {
    return { ok: false, error: `檔案過大,上限 ${Math.round(opts.maxBytes / MB)}MB` }
  }

  const allowedMimes = new Set<string>(opts.allowed.map((k) => KIND_TO_MIME[k]))

  // 內容嗅探(最終權威)。file-type 為純 ESM,用動態 import 相容 Next server。
  const { fileTypeFromBuffer } = await import('file-type')
  const buf = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buf)

  if (!detected || !allowedMimes.has(detected.mime)) {
    return { ok: false, error: '檔案格式無法辨識或不被接受' }
  }
  return { ok: true, mime: detected.mime, ext: detected.ext }
}
