import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { formatDate } from '../../utils/format.js'
import { clearProfile, editProfile, useMemoryStore } from '../../services/memory/store.js'
import {
  compressProfileIfNeeded,
  initMemory,
  stopMemory,
} from '../../services/memory/extract.js'
import {
  MEMORY_MAX_LENGTH_LIMIT,
  MEMORY_MAX_LENGTH_MIN,
  profileLength,
} from '../../services/memory/prompt.js'
import {
  setMemoryEnabled,
  setMemoryMaxLength,
  setMemoryRequirements,
  useSettings,
} from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import styles from './Settings.module.css'

/** 设置里的长期记忆：开关、最大长度、记忆要求和当前记忆编辑。 */
export const MemoryField = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const enabled = useSettings((state) => state.memoryEnabled)
  const maxLength = useSettings((state) => state.memoryMaxLength)
  const requirements = useSettings((state) => state.memoryRequirements)
  const profile = useMemoryStore((state) => state.profile)
  const [draft, setDraft] = useState(profile.summary)
  const [dirty, setDirty] = useState(false)
  const [profileChanged, setProfileChanged] = useState(false)
  const [requirementsDraft, setRequirementsDraft] = useState(requirements)
  const [requirementsDirty, setRequirementsDirty] = useState(false)
  const [maxDraft, setMaxDraft] = useState(String(maxLength))
  const [maxError, setMaxError] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const lastSummary = useRef(profile.summary)
  const length = profileLength(draft)
  const overLimit = length > maxLength
  const nearLimit = length >= Math.ceil(maxLength * 0.9)
  const updatedAt = profile.updatedAt ? formatDate(profile.updatedAt) : null

  useEffect(() => {
    setMaxDraft(String(maxLength))
  }, [maxLength])

  useEffect(() => {
    if (profile.summary === lastSummary.current) {
      return
    }
    lastSummary.current = profile.summary
    if (dirtyRef.current) {
      setProfileChanged(true)
    } else {
      setDraft(profile.summary)
    }
  }, [profile.summary])

  const toggle = () => {
    const next = !enabled
    setMemoryEnabled(next)
    if (next) {
      initMemory()
    } else {
      stopMemory()
    }
  }

  const saveMaxLength = () => {
    const value = Number(maxDraft)
    if (
      !Number.isInteger(value) ||
      value < MEMORY_MAX_LENGTH_MIN ||
      value > MEMORY_MAX_LENGTH_LIMIT
    ) {
      setMaxError(true)
      setMaxDraft(String(maxLength))
      return
    }
    setMaxError(false)
    if (value === maxLength) {
      return
    }
    setMemoryMaxLength(value)
    if (value < profileLength(profile.summary)) {
      setCompressing(true)
      void compressProfileIfNeeded().finally(() => setCompressing(false))
    }
  }

  const saveRequirements = () => {
    setMemoryRequirements(requirementsDraft)
    setRequirementsDraft(useSettings.getState().memoryRequirements)
    setRequirementsDirty(false)
  }

  const cancelRequirements = () => {
    setRequirementsDraft(requirements)
    setRequirementsDirty(false)
  }

  const saveProfile = () => {
    if (!draft.trim() || overLimit) {
      return
    }
    if (editProfile(draft)) {
      setDirty(false)
      setProfileChanged(false)
    }
  }

  const cancelProfile = () => {
    setDraft(profile.summary)
    setDirty(false)
    setProfileChanged(false)
  }

  const confirmClear = () => {
    clearProfile()
    stopMemory()
    setDraft('')
    setDirty(false)
    setProfileChanged(false)
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

        <div className={styles.memorySettingsRow}>
          <label className={styles.label} htmlFor="settings-memory-max-length">
            {t('settingsMemoryMaxLength')}
          </label>
          <input
            id="settings-memory-max-length"
            className={styles.memoryMaxLengthInput}
            type="number"
            min={MEMORY_MAX_LENGTH_MIN}
            max={MEMORY_MAX_LENGTH_LIMIT}
            step={100}
            value={maxDraft}
            aria-invalid={maxError}
            onChange={(event) => {
              setMaxDraft(event.target.value)
              setMaxError(false)
            }}
            onBlur={saveMaxLength}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                saveMaxLength()
              }
            }}
          />
          <div className={styles.memoryProfileMeta}>
            {t('settingsMemoryMaxLengthDescription', {
              min: MEMORY_MAX_LENGTH_MIN,
              max: MEMORY_MAX_LENGTH_LIMIT,
            })}
          </div>
          {maxError ? (
            <div className={styles.error}>
              {t('settingsMemoryMaxLengthInvalid', {
                min: MEMORY_MAX_LENGTH_MIN,
                max: MEMORY_MAX_LENGTH_LIMIT,
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.memorySettingsRow}>
          <div className={styles.memoryProfileHeader}>
            <label className={styles.label} htmlFor="settings-memory-requirements">
              {t('settingsMemoryRequirements')}
            </label>
          </div>
          <textarea
            id="settings-memory-requirements"
            className={clsx(styles.memoryProfileInput, styles.memoryRequirementsInput)}
            value={requirementsDraft}
            aria-describedby="settings-memory-requirements-help"
            onChange={(event) => {
              setRequirementsDraft(event.target.value)
              setRequirementsDirty(true)
            }}
          />
          <div className={styles.memoryProfileMeta} id="settings-memory-requirements-help">
            {t('settingsMemoryRequirementsDescription')}
          </div>
          <div className={styles.memoryProfileActions}>
            <Button size="m" disabled={!requirementsDirty} onClick={saveRequirements}>
              {t('settingsMemorySave')}
            </Button>
            {requirementsDirty ? (
              <Button variant="outlined" size="m" onClick={cancelRequirements}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.memoryProfileHeader}>
          <span className={styles.label}>{t('settingsMemoryProfile')}</span>
          <span className={styles.memoryProfileMeta}>
            {t('settingsMemoryProfileCount', { count: length, limit: maxLength })}
          </span>
        </div>
        {dirty && profileChanged ? (
          <div className={styles.memoryNotice}>{t('settingsMemoryProfileUpdated')}</div>
        ) : null}
        <textarea
          className={styles.memoryProfileInput}
          value={draft}
          placeholder={t('settingsMemoryProfilePlaceholder')}
          aria-label={t('settingsMemoryProfile')}
          aria-describedby="settings-memory-profile-count"
          onChange={(event) => {
            setDraft(event.target.value)
            setDirty(true)
            setProfileChanged(false)
          }}
        />
        <div className={styles.memoryProfileMeta} id="settings-memory-profile-count">
          {compressing
            ? t('settingsMemoryCompressing')
            : overLimit
              ? t('settingsMemoryProfileOverflow', { limit: maxLength })
              : nearLimit
                ? t('settingsMemoryProfileWarning', { limit: maxLength })
                : t('settingsMemoryProfileHelp', { limit: maxLength })}
        </div>
        <div className={styles.memoryProfileActions}>
          <Button size="m" disabled={!dirty || !draft.trim() || overLimit} onClick={saveProfile}>
            {t('settingsMemorySave')}
          </Button>
          {dirty ? (
            <Button variant="outlined" size="m" onClick={cancelProfile}>
              {t('cancel')}
            </Button>
          ) : null}
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
