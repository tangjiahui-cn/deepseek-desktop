import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { desktopApi } from '../../services/desktop/api.js'
import {
  checkDesktopUpdate,
  downloadDesktopUpdate,
  openDesktopRelease,
  useDesktopUpdate,
} from '../../services/desktop/update.js'
import { Button } from '../base/Button.js'
import styles from './Settings.module.css'

const META_VERSION = 'meta[name="application-version"]'

const readMetaVersion = (): string | null => {
  if (typeof document === 'undefined') {
    return null
  }
  const value = document.querySelector<HTMLMetaElement>(META_VERSION)?.content.trim()
  return value || null
}

const platformLabel = (platform: string): TranslationKey => {
  switch (platform) {
    case 'darwin':
      return 'versionPlatformMac'
    case 'win32':
      return 'versionPlatformWindows'
    case 'linux':
      return 'versionPlatformLinux'
    default:
      return 'versionPlatformWeb'
  }
}

const isUpdating = (phase: string | undefined): boolean =>
  phase === 'downloading' || phase === 'downloaded' || phase === 'installing'

/**
 * 设置中的版本信息：应用版本、平台与桌面运行时，以及行内式的更新入口。
 * 进入分组自动查询一次；Web 版只展示版本并禁用刷新。
 */
export const VersionField = () => {
  const t = useTranslate()
  const api = desktopApi()
  const update = useDesktopUpdate((state) => state.state)
  const [checking, setChecking] = useState(false)
  const [latest, setLatest] = useState(false)
  const sawChecking = useRef(false)
  const autoChecked = useRef(false)

  const version = update?.currentVersion || readMetaVersion()
  const phase = update?.phase ?? 'idle'
  const web = !api

  const runCheck = useCallback(async () => {
    if (!api) {
      return
    }
    setLatest(false)
    setChecking(true)
    sawChecking.current = false
    // 订阅 checking 阶段：IPC 可能在检查结束后才返回，不能只靠返回后的状态判断。
    const unsubscribe = useDesktopUpdate.subscribe((state) => {
      if (state.state?.phase === 'checking') {
        sawChecking.current = true
      }
    })
    try {
      await checkDesktopUpdate()
      let next = useDesktopUpdate.getState().state?.phase ?? 'idle'
      const started = Date.now()
      while (next === 'checking' && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        next = useDesktopUpdate.getState().state?.phase ?? 'idle'
      }
      if (sawChecking.current && next === 'idle') {
        setLatest(true)
      }
    } finally {
      unsubscribe()
      setChecking(false)
    }
  }, [api])

  useEffect(() => {
    if (!api || autoChecked.current) {
      return
    }
    autoChecked.current = true
    if (isUpdating(useDesktopUpdate.getState().state?.phase)) {
      return
    }
    void runCheck()
  }, [api, runCheck])

  const checkingNow = checking || phase === 'checking'
  const updating = isUpdating(phase)
  const available = phase === 'available'
  const progress = Math.min(100, Math.max(0, Math.round(update?.progress ?? 0)))

  let status: { key: TranslationKey; params?: Record<string, string | number> } | null = null
  if (web) {
    status = { key: 'versionUpdateWebDisabled' }
  } else if (checkingNow) {
    status = { key: 'versionUpdateChecking' }
  } else if (phase === 'error') {
    status = { key: 'versionUpdateFailed' }
  } else if (available) {
    status = {
      key: 'versionUpdateAvailable',
      params: { version: update?.latestVersion ?? '' },
    }
  } else if (phase === 'downloading') {
    status = { key: 'versionUpdateDownloading', params: { progress } }
  } else if (phase === 'downloaded') {
    status = { key: 'versionUpdateDownloaded' }
  } else if (phase === 'installing') {
    status = { key: 'versionUpdateInstalling' }
  } else if (latest) {
    status = { key: 'versionUpdateLatest' }
  }

  const buttonLabel = web
    ? t('versionUpdateRefresh')
    : checkingNow
      ? t('versionUpdateQuerying')
      : available || updating
        ? t('versionUpdateDownload')
        : t('versionUpdateRefresh')
  const buttonDisabled = web || checkingNow || updating

  const act = () => {
    if (available) {
      void (update?.canDownload ? downloadDesktopUpdate() : openDesktopRelease())
      return
    }
    void runCheck()
  }

  const versionRows: { label: string; value: string }[] = [
    { label: t('versionAppVersion'), value: version ?? t('versionUnknown') },
    { label: t('versionPlatform'), value: t(platformLabel(api?.platform ?? '')) },
  ]
  if (api) {
    versionRows.push(
      { label: t('versionElectron'), value: api.versions.electron || t('versionUnknown') },
      { label: t('versionChromium'), value: api.versions.chrome || t('versionUnknown') },
      { label: t('versionNode'), value: api.versions.node || t('versionUnknown') }
    )
  }

  return (
    <div className={styles.version}>
      <div className={styles.versionInfo}>
        {versionRows.map((row) => (
          <div key={row.label} className={styles.versionRow}>
            <span className={styles.versionName}>{row.label}</span>
            <span className={styles.versionValue}>{row.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.versionAction}>
        <span className={styles.versionActionLabel}>{t('versionUpdateTitle')}</span>
        {status ? (
          <span
            className={styles.versionActionStatus}
            title={phase === 'error' ? (update?.error ?? undefined) : undefined}
          >
            {t(status.key, status.params)}
          </span>
        ) : null}
        <Button
          variant="outlined"
          size="s"
          className={styles.versionActionButton}
          aria-busy={checkingNow}
          disabled={buttonDisabled}
          onClick={act}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
