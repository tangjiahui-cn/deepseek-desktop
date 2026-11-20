import { useState } from 'react'
import { Button } from '../base/Button.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import { useTranslate } from '../../i18n/index.js'
import {
  cancelDesktopUpdate,
  checkDesktopUpdate,
  dismissDesktopUpdate,
  downloadDesktopUpdate,
  installDesktopUpdate,
  isGeneratingReply,
  openDesktopRelease,
  useDesktopUpdate,
} from '../../services/desktop/update.js'
import styles from './UpdateTag.module.css'

/** 侧栏底部的更新提示；关闭只对当前版本生效，出现更高版本会再次出现 */
export const UpdateTag = () => {
  const t = useTranslate()
  const state = useDesktopUpdate((value) => value.state)
  const [confirming, setConfirming] = useState(false)

  if (
    !state ||
    state.dismissed ||
    state.phase === 'idle' ||
    state.phase === 'checking' ||
    state.phase === 'installing'
  ) {
    return null
  }

  const version = state.latestVersion ?? ''
  const close = () => dismissDesktopUpdate(version)
  const closeButton = version ? (
    <button type="button" className={styles.close} aria-label={t('updateDismiss')} onClick={close}>
      <IconCloseOutline16 />
    </button>
  ) : null

  if (state.phase === 'downloading') {
    const progress = Math.min(100, Math.max(0, Math.round(state.progress ?? 0)))
    return (
      <div className={styles.tag} role="status">
        <div className={styles.title}>{t('updateDownloading', { progress })}</div>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.bar} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => void cancelDesktopUpdate()}>
            {t('updateCancel')}
          </button>
        </div>
      </div>
    )
  }

  if (state.phase === 'downloaded') {
    const install = () => {
      if (isGeneratingReply()) {
        setConfirming(true)
        return
      }
      void installDesktopUpdate()
    }
    return (
      <>
        <div className={styles.tag} role="status">
          <div className={styles.head}>
            <div className={styles.title}>{t('updateReady', { version })}</div>
            {closeButton}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={install}>
              {t('updateInstall')}
            </button>
          </div>
        </div>
        {confirming ? (
          <Modal
            title={t('updateInstall')}
            onClose={() => setConfirming(false)}
            footer={
              <>
                <Button variant="outlined" onClick={() => setConfirming(false)}>
                  {t('updateCancel')}
                </Button>
                <Button
                  onClick={() => {
                    setConfirming(false)
                    void installDesktopUpdate()
                  }}
                >
                  {t('updateInstall')}
                </Button>
              </>
            }
          >
            {t('updateStreamingConfirm')}
          </Modal>
        ) : null}
      </>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className={styles.tag} role="status">
        <div className={styles.head}>
          <div className={styles.title} title={state.error ?? undefined}>
            {t('updateFailed')}
          </div>
          {closeButton}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void (state.latestVersion ? downloadDesktopUpdate() : checkDesktopUpdate())}
          >
            {t('updateRetry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tag} role="status">
      <div className={styles.head}>
        <div className={styles.title}>{t('updateAvailable', { version })}</div>
        {closeButton}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void (state.canDownload ? downloadDesktopUpdate() : openDesktopRelease())}
        >
          {state.canDownload ? t('updateDownload') : t('updateOpenDownload')}
        </button>
      </div>
    </div>
  )
}
