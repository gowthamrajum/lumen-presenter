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
  pptxExport: 'pptx:export',
  bibleLoad: 'bible:load',
  servicesList: 'services:list',
  serviceSave: 'services:save',
  serviceLoad: 'services:load',
  serviceDelete: 'services:delete',
  serviceExport: 'services:export',
  serviceImport: 'services:import',
  songsList: 'songs:list',
  songSave: 'songs:save',
  songLoad: 'songs:load',
  songDelete: 'songs:delete',
  songsRemote: 'songs:remote',
  psalmsGet: 'psalms:get',
  esvKeyStatus: 'esv:keyStatus',
  esvKeySet: 'esv:keySet',
  broadcastGet: 'broadcast:get',
  broadcastSet: 'broadcast:set',
  broadcastStatusGet: 'broadcast:statusGet',

  // services built on the web and kept on the relay
  servicesRemote: 'services:remoteList',
  serviceRemoteGet: 'services:remoteGet',

  // main -> renderers (send)
  liveState: 'live:state',
  screensChanged: 'screens:changed',
  displaysChanged: 'displays:changed',
  broadcastStatus: 'broadcast:status',
  // main -> control: progress of a running PowerPoint export
  pptxExportProgress: 'pptx:exportProgress',
  // output window -> control (forwarded key presses)
  outputKey: 'output:key',
  // main -> each output: whether THIS window is the one that may play sound.
  // Two audience screens would otherwise echo the clip a beat apart.
  audioOwner: 'output:audioOwner',
  // output -> main -> control: a clip with sound reached its end
  mediaEnded: 'output:mediaEnded',
  // control -> main -> outputs: play / pause / seek the clip on screen
  mediaControl: 'media:control',
  // outputs -> main -> control: where that clip has got to
  mediaState: 'media:state',
  // main -> control: the relay says a service was created / edited / removed
  servicesChanged: 'services:changed',
  // main -> control: a command from a phone remote (next/prev/goto/…)
  remoteCommand: 'remote:command'
} as const
