import type { Translation } from './types'

// A small public-domain sample (World English Bible, WEB) so the app is
// useful out of the box. Import a full translation of the same JSON shape
// ({ name, verses: [{ book, chapter, verse, text }] }) to expand coverage.
export const SAMPLE_TRANSLATION: Translation = {
  name: 'WEB (sample)',
  verses: [
    // Genesis 1
    { book: 'Genesis', chapter: 1, verse: 1, text: 'In the beginning, God created the heavens and the earth.' },
    { book: 'Genesis', chapter: 1, verse: 2, text: 'The earth was formless and empty. Darkness was on the surface of the deep and God’s Spirit was hovering over the surface of the waters.' },
    { book: 'Genesis', chapter: 1, verse: 3, text: 'God said, “Let there be light,” and there was light.' },
    { book: 'Genesis', chapter: 1, verse: 4, text: 'God saw the light, and saw that it was good. God divided the light from the darkness.' },
    { book: 'Genesis', chapter: 1, verse: 5, text: 'God called the light “day”, and the darkness he called “night”. There was evening and there was morning, the first day.' },

    // Psalm 1
    { book: 'Psalms', chapter: 1, verse: 1, text: 'Blessed is the man who doesn’t walk in the counsel of the wicked, nor stand on the path of sinners, nor sit in the seat of scoffers;' },
    { book: 'Psalms', chapter: 1, verse: 2, text: 'but his delight is in Yahweh’s law. On his law he meditates day and night.' },
    { book: 'Psalms', chapter: 1, verse: 3, text: 'He will be like a tree planted by the streams of water, that produces its fruit in its season, whose leaf also does not wither. Whatever he does shall prosper.' },

    // Psalm 23
    { book: 'Psalms', chapter: 23, verse: 1, text: 'Yahweh is my shepherd; I shall lack nothing.' },
    { book: 'Psalms', chapter: 23, verse: 2, text: 'He makes me lie down in green pastures. He leads me beside still waters.' },
    { book: 'Psalms', chapter: 23, verse: 3, text: 'He restores my soul. He guides me in the paths of righteousness for his name’s sake.' },
    { book: 'Psalms', chapter: 23, verse: 4, text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.' },
    { book: 'Psalms', chapter: 23, verse: 5, text: 'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.' },
    { book: 'Psalms', chapter: 23, verse: 6, text: 'Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh’s house forever.' },

    // Psalm 121
    { book: 'Psalms', chapter: 121, verse: 1, text: 'I will lift up my eyes to the hills. Where does my help come from?' },
    { book: 'Psalms', chapter: 121, verse: 2, text: 'My help comes from Yahweh, who made heaven and earth.' },
    { book: 'Psalms', chapter: 121, verse: 3, text: 'He will not allow your foot to be moved. He who keeps you will not slumber.' },

    // Matthew 5 (Beatitudes)
    { book: 'Matthew', chapter: 5, verse: 3, text: '“Blessed are the poor in spirit, for theirs is the Kingdom of Heaven.' },
    { book: 'Matthew', chapter: 5, verse: 4, text: 'Blessed are those who mourn, for they shall be comforted.' },
    { book: 'Matthew', chapter: 5, verse: 5, text: 'Blessed are the gentle, for they shall inherit the earth.' },
    { book: 'Matthew', chapter: 5, verse: 6, text: 'Blessed are those who hunger and thirst for righteousness, for they shall be filled.' },

    // John 1
    { book: 'John', chapter: 1, verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
    { book: 'John', chapter: 1, verse: 2, text: 'The same was in the beginning with God.' },
    { book: 'John', chapter: 1, verse: 3, text: 'All things were made through him. Without him, nothing was made that has been made.' },
    { book: 'John', chapter: 1, verse: 4, text: 'In him was life, and the life was the light of men.' },
    { book: 'John', chapter: 1, verse: 5, text: 'The light shines in the darkness, and the darkness hasn’t overcome it.' },

    // John 3
    { book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.' },
    { book: 'John', chapter: 3, verse: 17, text: 'For God didn’t send his Son into the world to judge the world, but that the world should be saved through him.' },

    // Romans 8
    { book: 'Romans', chapter: 8, verse: 28, text: 'We know that all things work together for good for those who love God, for those who are called according to his purpose.' },
    { book: 'Romans', chapter: 8, verse: 38, text: 'For I am persuaded that neither death, nor life, nor angels, nor principalities, nor things present, nor things to come, nor powers,' },
    { book: 'Romans', chapter: 8, verse: 39, text: 'nor height, nor depth, nor any other created thing will be able to separate us from God’s love which is in Christ Jesus our Lord.' },

    // 1 Corinthians 13
    { book: '1 Corinthians', chapter: 13, verse: 4, text: 'Love is patient and is kind. Love doesn’t envy. Love doesn’t brag, is not proud,' },
    { book: '1 Corinthians', chapter: 13, verse: 5, text: 'doesn’t behave itself inappropriately, doesn’t seek its own way, is not provoked, takes no account of evil;' },
    { book: '1 Corinthians', chapter: 13, verse: 6, text: 'doesn’t rejoice in unrighteousness, but rejoices with the truth;' },
    { book: '1 Corinthians', chapter: 13, verse: 7, text: 'bears all things, believes all things, hopes all things, and endures all things.' },
    { book: '1 Corinthians', chapter: 13, verse: 13, text: 'But now faith, hope, and love remain—these three. The greatest of these is love.' },

    // Philippians 4
    { book: 'Philippians', chapter: 4, verse: 4, text: 'Rejoice in the Lord always! Again I will say, “Rejoice!”' },
    { book: 'Philippians', chapter: 4, verse: 6, text: 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.' },
    { book: 'Philippians', chapter: 4, verse: 7, text: 'And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.' },
    { book: 'Philippians', chapter: 4, verse: 13, text: 'I can do all things through Christ, who strengthens me.' }
  ]
}
