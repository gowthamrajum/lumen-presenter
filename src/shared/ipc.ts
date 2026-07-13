// Canonical IPC channel names shared by main / preload / renderer.
export const IPC = {
  // control -> main (invoke)
  displaysList: 'displays:list',
  screenSet: 'screen:set',
  screensStatus: 'screens:status',
  liveGet: 'live:get',
  liveSet: 'live:set',
  pickMedia: 'media:pick',
  pickPptx: 'pptx:pick',
  bibleLoad: 'bible:load',
  servicesList: 'services:list',
  serviceSave: 'services:save',
  serviceLoad: 'services:load',
  serviceDelete: 'services:delete',
  songsList: 'songs:list',
  songSave: 'songs:save',
  songLoad: 'songs:load',
  songDelete: 'songs:delete',
  songsRemote: 'songs:remote',
  psalmsGet: 'psalms:get',
  broadcastGet: 'broadcast:get',
  broadcastSet: 'broadcast:set',
  broadcastStatusGet: 'broadcast:statusGet',

  // main -> renderers (send)
  liveState: 'live:state',
  screensChanged: 'screens:changed',
  displaysChanged: 'displays:changed',
  broadcastStatus: 'broadcast:status',
  // output window -> control (forwarded key presses)
  outputKey: 'output:key'
} as const
