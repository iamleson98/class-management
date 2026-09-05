/**
 * Shared layout constants for the chat message column.
 *
 * The message list, typing indicator and composer must all line up in the
 * exact same centered column, so the class lives here as a single source of
 * truth instead of being duplicated across components.
 *
 * Width strategy (why the responsive steps): the channel center panel is
 * `flex-1` between the channel sidebar and the RHS pane, so its width varies
 * a lot with the viewport and with which panes are open. A fixed `max-w-4xl`
 * (896px) left big displays with large dead margins around a narrow column.
 * The steps below grow the column as screens get bigger while still capping
 * it at a comfortable reading width for chat bubbles:
 *   - max-w-4xl (896px)  — laptops / narrow center panels (cap rarely binds)
 *   - lg:max-w-5xl (1024px) — large laptops, RHS open
 *   - xl:max-w-6xl (1152px) — desktops, RHS closed
 *   - 2xl:max-w-7xl (1280px) — wide displays; the practical ceiling for
 *     readable bubble chat (per-bubble max-w keeps line lengths sane)
 */
export const MESSAGE_COLUMN_CLASS =
  'mx-auto w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'

/** Horizontal padding used inside the message column (list + composer). */
export const MESSAGE_COLUMN_PADDING = 'px-4 sm:px-6'
