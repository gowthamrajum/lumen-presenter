// Canonical IPC channel names shared by main / preload / renderer.
export const IPC = {
  // control -> main (invoke)
  displaysList: 'displays:list',
  outputOpen: 'output:open',
  outputClose: 'output:close',
  outputStatus: 'output:status',
  liveGet: 'live:get',
  liveSet: 'live:set',
  pickMedia: 'media:pick',
  pickPptx: 'pptx:pick',

  // main -> renderers (send)
  liveState: 'live:state',
  outputChanged: 'output:changed',
  displaysChanged: 'displays:changed'
} as const
