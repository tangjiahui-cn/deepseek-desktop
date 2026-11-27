import clsx from 'clsx'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconBookmarkOutline16,
  IconPanelLeftOutline16,
  IconSettingsOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import { newChat, openBookmark, removeSession, useChatStore } from '../../services/chat/store.js'
import { useBookmarks } from '../../services/bookmarks.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { UpdateTag } from '../update/UpdateTag.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import { BookmarkItem, type BookmarkListItem } from './BookmarkItem.js'
import styles from './Sider.module.css'

type SessionTab = 'all' | 'favorites' | 'bookmarks'

/** 展开的侧边栏：名称与收起按钮、开启新对话、全部/收藏夹切换、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const bookmarks = useBookmarks((state) => state.items)
  const [now, setNow] = useState(Date.now)
  const [tab, setTab] = useState<SessionTab>('all')
  const tabId = useId()
  const panelId = `${tabId}-panel`
  const groups = useMemo(
    () =>
      tab === 'bookmarks'
        ? []
        : groupSessions(
            tab === 'favorites' ? sessions.filter((session) => session.favorite) : sessions,
            now,
            t
          ),
    [sessions, now, tab, t]
  )
  const bookmarkItems = useMemo<BookmarkListItem[]>(() => {
    const byId = new Map(sessions.map((session) => [session.id, session]))
    return bookmarks.flatMap((bookmark) => {
      const session = byId.get(bookmark.sessionId)
      return session ? [{ ...bookmark, sourceTitle: session.title || t('untitledChat') }] : []
    })
  }, [bookmarks, sessions, t])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // 书签使用相对时间，标签页激活时每分钟刷新一次。
  useEffect(() => {
    if (tab !== 'bookmarks') {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [tab])

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        <IconButton
          size="m"
          icon={<IconPanelLeftOutline16 />}
          tooltip={t('collapseSiderbarButton')}
          tooltipPlacement="bottom"
          onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
        />
      </div>
      <button
        type="button"
        className={styles.newChat}
        onClick={() => {
          newChat()
          closeMobileSider()
        }}
      >
        <span className={styles.newChatIcon}>
          <NewChatIcon />
        </span>
        {t('newChat')}
      </button>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          id={`${tabId}-all`}
          aria-selected={tab === 'all'}
          aria-controls={panelId}
          className={clsx(styles.tab, tab === 'all' && styles.tabActive)}
          onClick={() => setTab('all')}
        >
          {t('siderTabAll')}
        </button>
        <button
          type="button"
          role="tab"
          id={`${tabId}-favorites`}
          aria-selected={tab === 'favorites'}
          aria-controls={panelId}
          className={clsx(styles.tab, tab === 'favorites' && styles.tabActive)}
          onClick={() => setTab('favorites')}
        >
          {t('siderTabFavorites')}
        </button>
        <button
          type="button"
          role="tab"
          id={`${tabId}-bookmarks`}
          aria-selected={tab === 'bookmarks'}
          aria-controls={panelId}
          className={clsx(styles.tab, tab === 'bookmarks' && styles.tabActive)}
          onClick={() => setTab('bookmarks')}
        >
          {t('siderTabBookmarks')}
        </button>
      </div>
      <div className={styles.listWrap}>
        <div
          className={styles.list}
          role="tabpanel"
          id={panelId}
          aria-labelledby={
            tab === 'all'
              ? `${tabId}-all`
              : tab === 'favorites'
                ? `${tabId}-favorites`
                : `${tabId}-bookmarks`
          }
        >
          {tab === 'bookmarks' ? (
            bookmarkItems.length === 0 ? (
              <div className={styles.bookmarkEmpty}>
                <div className={styles.bookmarkEmptyIcon}>
                  <IconBookmarkOutline16 />
                </div>
                <div className={styles.bookmarkEmptyTitle}>{t('siderBookmarksEmpty')}</div>
                <div className={styles.bookmarkEmptyHint}>
                  {t('siderBookmarksEmptyHintLine1')}
                  <br />
                  {t('siderBookmarksEmptyHintLine2')}
                </div>
              </div>
            ) : (
              bookmarkItems.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.messageId}
                  bookmark={bookmark}
                  now={now}
                  onOpen={() => {
                    closeMobileSider()
                    void openBookmark(bookmark.sessionId, bookmark.messageId)
                      .then((result) => {
                        if (result === 'missing') {
                          showToast({ key: 'bookmarkMissing' })
                        } else if (result === 'busy') {
                          showToast({ key: 'bookmarkJumpBusy' })
                        } else if (result === 'failed') {
                          showToast({ key: 'bookmarkJumpFailed', type: 'error' })
                        }
                      })
                      .catch(() => showToast({ key: 'bookmarkJumpFailed', type: 'error' }))
                  }}
                />
              ))
            )
          ) : tab === 'favorites' && groups.length === 0 ? (
            <div className={styles.empty}>{t('siderFavoritesEmpty')}</div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className={styles.section}>
                <div className={styles.sectionHeader}>{group.label}</div>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeId}
                    onDelete={() => setDeleting(session)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      <UpdateTag />
      <div className={styles.bottom}>
        <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
          <span className={styles.settingsIcon}>
            <IconSettingsOutline16 />
          </span>
          <span className={styles.settingsLabel}>{t('settings')}</span>
        </button>
      </div>
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
