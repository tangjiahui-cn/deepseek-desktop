import clsx from 'clsx'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { setSessionFavorite } from '../../services/chat/store.js'
import type { Session } from '../../services/chat/types.js'
import { IconStarDashed16, IconStarFill16 } from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MessageList } from '../messages/MessageList.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './SessionView.module.css'

/** 会话页：标题栏（移动端为顶栏）+ 消息列表，输入框吸底 */
export const SessionView = ({
  session,
  streaming,
  siderCollapsed,
}: {
  session: Session
  streaming: boolean
  siderCollapsed: boolean
}) => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const title = session.title || t('untitledChat')
  const favorite = session.favorite === true
  return (
    <div className={styles.view}>
      {isMobile ? (
        <MobileHeader title={title} />
      ) : (
        <div className={styles.header}>
          <div className={clsx(styles.title, siderCollapsed && styles.withCollapsedSider)}>
            {title}
          </div>
          <button
            type="button"
            className={styles.favorite}
            aria-label={t(
              favorite ? 'sessionItemMenuUnfavoriteOption' : 'sessionItemMenuFavoriteOption'
            )}
            onClick={() => {
              const next = !favorite
              setSessionFavorite(session.id, next)
              showToast({ key: next ? 'sessionFavorited' : 'sessionUnfavorited' })
            }}
          >
            {favorite ? <IconStarFill16 /> : <IconStarDashed16 />}
          </button>
        </div>
      )}
      <MessageList
        session={session}
        streaming={streaming}
        footer={
          <div className={styles.inputContainer}>
            <ChatInput sessionId={session.id} />
            <div className={styles.caveat}>{t('contentCaveat')}</div>
          </div>
        }
      />
    </div>
  )
}
