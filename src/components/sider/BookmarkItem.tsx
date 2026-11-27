import { useTranslate } from '../../i18n/index.js'
import type { Bookmark } from '../../services/chat/types.js'
import { formatDate } from '../../utils/format.js'
import styles from './BookmarkItem.module.css'

export type BookmarkListItem = Bookmark & { sourceTitle: string }

const formatSavedAt = (
  createdAt: number,
  now: number,
  t: ReturnType<typeof useTranslate>
): string => {
  const minutes = Math.floor(Math.max(0, now - createdAt) / 60_000)
  if (minutes < 1) {
    return t('bookmarkTimeJustNow')
  }
  if (minutes < 60) {
    return t('bookmarkTimeMinutesAgo', { count: minutes })
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return t('bookmarkTimeHoursAgo', { count: hours })
  }
  const days = Math.floor(hours / 24)
  if (days === 1) {
    return t('bookmarkTimeYesterday')
  }
  if (days < 7) {
    return t('bookmarkTimeDaysAgo', { count: days })
  }
  return formatDate(createdAt) ?? ''
}

/** 侧栏书签项：回答摘要 + 来源对话 + 保存时间；不显示任何前置图标。 */
export const BookmarkItem = ({
  bookmark,
  now,
  onOpen,
}: {
  bookmark: BookmarkListItem
  now: number
  onOpen: () => void
}) => {
  const t = useTranslate()
  return (
    <button type="button" className={styles.item} title={bookmark.excerpt} onClick={onOpen}>
      <span className={styles.excerpt}>{bookmark.excerpt}</span>
      <span className={styles.meta}>
        <span className={styles.source}>{bookmark.sourceTitle}</span>
        <span className={styles.time}>{formatSavedAt(bookmark.createdAt, now, t)}</span>
      </span>
    </button>
  )
}
