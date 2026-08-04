/**
 * Singing marks — the instructions on a song sheet, as opposed to the words of
 * the song.
 *
 * "(2)" means sing the line twice; "||యెహోవా||" means go back to the Pallavi.
 * On the projector they are doing their job, because the congregation is
 * following along and needs them. On a YouTube lower third nobody is singing
 * from the screen, and they read as clutter across the bottom of the picture.
 *
 * Only the marks go. Numbers inside the line are untouched — a hymn that says
 * "forty days" still says it, and "Psalm 23:1" keeps its reference — so this
 * removes annotations, not digits.
 *
 * Shared because two places have to agree about it: the publisher, which
 * decides what the OBS overlay is sent, and the Parity Display, which shows the
 * operator what the OBS overlay will look like. A copy in each is a promise
 * that they will drift.
 */
const REPEAT_MARKER = /\s*\|\|[^|]*\|\|\s*/g
const REPEAT_COUNT = /\s*[(（]\s*\d+\s*[)）]\s*$/

export function stripSingingMarks(line: string): string {
  return line
    .replace(REPEAT_MARKER, ' ')
    .replace(REPEAT_COUNT, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
