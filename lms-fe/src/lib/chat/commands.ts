/**
 * Slash commands — ports the vendored webapp's actions/command.ts +
 * command_provider. Detects a leading `/`, offers autocomplete (server-side
 * suggestions via getCommandAutocompleteSuggestionsList), and executes either
 * a client-handled command (/search /shortcuts /leave /settings /collapse
 * /expand) or forwards to the server (Client4.executeCommand). Server responses
 * carrying `text` arrive as an ephemeral post via the websocket; `goto_location`
 * is navigated client-side.
 */

import { client4 } from './client'

export interface CommandArgs {
  team_id: string
  channel_id: string
  root_id?: string
}

export interface CommandResult {
  /** True if handled entirely on the client (no server call). */
  frontendHandled: boolean
  /** Ephemeral text to show the user (from a server response). */
  message?: string
  /** URL/path to navigate to (from a server response). */
  gotoLocation?: string
  /** Error message if execution failed. */
  error?: string
}

/** The client-side commands that never hit the server (verbatim from command.ts). */
const FRONTEND_COMMANDS = new Set(['/search', '/shortcuts', '/leave', '/settings', '/marketplace', '/collapse', '/expand'])

/**
 * Execute a slash command. Returns the result; the caller decides how to render
 * ephemeral messages / navigate. The set of client-handled commands mirrors the
 * vendored executeCommand switch.
 */
export async function executeCommand(
  rawMessage: string,
  args: CommandArgs,
  handlers: {
    onSearch?: (term: string) => void
    onOpenShortcuts?: () => void
    onOpenSettings?: () => void
    onLeaveChannel?: (channelId: string) => void
    onCollapsePreviews?: () => void
    onExpandPreviews?: () => void
  } = {},
): Promise<CommandResult> {
  const msg = rawMessage.trim()
  if (!msg.startsWith('/')) {
    return { frontendHandled: false }
  }

  const cmdLength = msg.indexOf(' ')
  const cmd = (cmdLength === -1 ? msg : msg.substring(0, cmdLength)).toLowerCase()
  const rest = cmdLength === -1 ? '' : msg.substring(cmdLength + 1).trim()

  // ── Client-handled commands (never sent to the server) ──
  switch (cmd) {
    case '/search':
      handlers.onSearch?.(rest)
      return { frontendHandled: true }
    case '/shortcuts':
      handlers.onOpenShortcuts?.()
      return { frontendHandled: true }
    case '/settings':
      handlers.onOpenSettings?.()
      return { frontendHandled: true }
    case '/leave':
      handlers.onLeaveChannel?.(args.channel_id)
      return { frontendHandled: true }
    case '/collapse':
      handlers.onCollapsePreviews?.()
      return { frontendHandled: true }
    case '/expand':
      handlers.onExpandPreviews?.()
      return { frontendHandled: true }
  }

  // ── Server commands ──
  try {
    const data = await client4.executeCommand(msg, args)
    const result: CommandResult = { frontendHandled: false }
    if (data.text) result.message = data.text
    if (data.goto_location) result.gotoLocation = data.goto_location
    return result
  } catch (err) {
    return { frontendHandled: false, error: err instanceof Error ? err.message : 'Command failed' }
  }
}

/** Whether a message starts with a slash command (and isn't escaped). */
export function isSlashCommand(message: string): boolean {
  return message.startsWith('/') && !message.startsWith('//')
}

/** Whether a command is handled client-side. */
export function isFrontendCommand(command: string): boolean {
  const cmd = command.split(' ')[0].toLowerCase()
  return FRONTEND_COMMANDS.has(cmd)
}

/** Trigger character for the command autocomplete provider. */
export const COMMAND_TRIGGER = '/'

/**
 * Fetch autocomplete suggestions for a `/command` prefix. Wraps
 * getCommandAutocompleteSuggestionsList; returns [] on error.
 */
export async function getCommandSuggestions(userInput: string, teamId: string, args: CommandArgs): Promise<
  { Complete: string; Suggestion: string; Hint: string; Description: string; IconData: string }[]
> {
  try {
    return await client4.getCommandAutocompleteSuggestionsList(userInput, teamId, args)
  } catch {
    return []
  }
}
