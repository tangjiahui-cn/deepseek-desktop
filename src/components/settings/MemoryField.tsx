import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { formatDate } from '../../utils/format.js'
import {
  clearProfile,
  editProfile,
  resumeAutoUpdate,
  undoProfile,
  useMemoryStore,
} from '../../services/memory/store.js'
import { initMemory, stopMemory } from '../../services/memory/extract.js'
import {
  MEMORY_PROFILE_MAX,
  MEMORY_PROFILE_TARGET,
  profileLength,
} from '../../services/memory/prompt.js'
import { setMemoryEnabled, useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import styles from './Settings.module.css'

/** 设置里的长期画像：总开关、画像编辑、撤销、自动更新暂停与清空。 */
export const MemoryField = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const enabled = useSettings((state) => state.memoryEnabled)
  const profile = useMemoryStore((state) => state.profile)
  const [draft, setDraft] = useState(profile.summary)
  const [dirty, setDirty] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const length = profileLength(draft)
  const overLimit = length > MEMORY_PROFILE_MAX
  const nearLimit = length >= MEMORY_PROFILE_TARGET + 400
  const updatedAt = profile.updatedAt ? formatDate(profile.updatedAt) : null

  useEffect(() => {
    if (!dirty) {
      setDraft(profile.summary)
    }
  }, [profile.summary, dirty])

  const toggle = () => {
    const next = !enabled
    setMemoryEnabled(next)
    if (next) {
      initMemory()
    } else {
      stopMemory()
    }
  }

  const save = () => {
    if (!draft.trim() || overLimit) {
      return
    }
    if (editProfile(draft)) {
      setDirty(false)
      stopMemory()
    }
  }

  const cancel = () => {
    setDraft(profile.summary)
    setDirty(false)
  }

  const resume = () => {
    resumeAutoUpdate()
    initMemory()
  }

  const undo = () => {
    if (undoProfile()) {
      setDirty(false)
      stopMemory()
    }
  }

  const confirmClear = () => {
    clearProfile()
    stopMemory()
    setDraft('')
    setDirty(false)
    setClearOpen(false)
    showToast({ key: 'settingsMemoryCleared' })
  }

  return (
    <>
      <div className={styles.memory}>
        <div className={styles.memoryHeader}>
          <div className={styles.memoryHeaderText}>
            <div className={styles.label}>{t('settingsMemoryEnabled')}</div>
            <div className={styles.description}>{t('settingsMemoryDescription')}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('settingsMemoryEnabled')}
            className={clsx(styles.memorySwitch, enabled && styles.memorySwitchOn)}
            onClick={toggle}
          >
            <span className={styles.memorySwitchKnob} aria-hidden="true" />
          </button>
        </div>

        {!enabled ? (
          <div className={styles.memoryNotice}>{t('settingsMemoryDisabledNotice')}</div>
        ) : null}
        {profile.userEdited ? (
          <div className={styles.memoryPaused}>
            <span>{t('settingsMemoryUserEdited')}</span>
            <Button variant="outlined" size="s" onClick={resume}>
              {t('settingsMemoryResumeAuto')}
            </Button>
          </div>
        ) : null}
        {profile.overflow ? (
          <div className={styles.memoryPaused}>
            <span>{t('settingsMemoryProfileOverflow')}</span>
            <Button variant="outlined" size="s" onClick={resume}>
              {t('settingsMemoryResumeAuto')}
            </Button>
          </div>
        ) : null}

        <div className={styles.memoryProfileHeader}>
          <span className={styles.label}>{t('settingsMemoryProfile')}</span>
          <span className={styles.memoryProfileMeta}>
            {t('settingsMemoryProfileCount', { count: length, limit: MEMORY_PROFILE_MAX })}
          </span>
        </div>
        <textarea
          className={styles.memoryProfileInput}
          value={draft}
          placeholder={t('settingsMemoryProfilePlaceholder')}
          aria-label={t('settingsMemoryProfile')}
          aria-describedby="settings-memory-profile-count"
          onChange={(event) => {
            setDraft(event.target.value)
            setDirty(true)
          }}
        />
        <div className={styles.memoryProfileMeta} id="settings-memory-profile-count">
          {overLimit
            ? t('settingsMemoryProfileOverflow')
            : nearLimit
              ? t('settingsMemoryProfileWarning')
              : t('settingsMemoryProfileHelp')}
        </div>
        <div className={styles.memoryProfileActions}>
          <Button size="m" disabled={!dirty || !draft.trim() || overLimit} onClick={save}>
            {t('settingsMemorySave')}
          </Button>
          {dirty ? (
            <Button variant="outlined" size="m" onClick={cancel}>
              {t('cancel')}
            </Button>
          ) : null}
          <Button
            variant="outlined"
            size="m"
            disabled={profile.revisions.length === 0}
            onClick={undo}
          >
            {t('settingsMemoryUndo')}
          </Button>
          <Button
            variant="dangerOutlined"
            size="m"
            disabled={!profile.summary && !dirty}
            onClick={() => setClearOpen(true)}
          >
            {t('settingsMemoryClear')}
          </Button>
        </div>

        <div className={styles.memoryProfileMeta}>
          {profile.updatedAt
            ? t('settingsMemoryLastUpdated', {
                title: profile.lastSessionTitle || t('untitledChat'),
                date: updatedAt ?? new Date(profile.updatedAt).toLocaleDateString(locale),
              })
            : t('settingsMemoryNeverUpdated')}
        </div>
      </div>

      {clearOpen ? (
        <Modal
          title={t('settingsMemoryClearConfirmTitle')}
          className={styles.deleteConfirm}
          onClose={() => setClearOpen(false)}
          footer={
            <div className={styles.deleteActions}>
              <Button variant="outlined" autoFocus onClick={() => setClearOpen(false)}>
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={confirmClear}>
                {t('settingsMemoryClear')}
              </Button>
            </div>
          }
        >
          {t('settingsMemoryClearConfirmDescription')}
        </Modal>
      ) : null}
    </>
  )
}
