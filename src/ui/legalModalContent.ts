import { otherMeadowCharacter, type MeadowCharacterId } from '../config/meadowCharacter';

export type LegalModalId = 'about' | 'terms' | 'privacy' | 'research';

export type LegalModalCitation = {
  label: string;
  url: string;
};

export type LegalModalSection = {
  heading?: string;
  subheading?: string;
  paragraphs: string[];
  citations?: LegalModalCitation[];
};

export type LegalModalContent = {
  id: LegalModalId;
  title: string;
  lastUpdated?: string;
  sections: LegalModalSection[];
};

/**
 * Per-character origin stories (file-card sections). The About modal shows the
 * CURRENT character's story first, then the other character's, then the shared
 * experience closing. Booster's copy is the shipped verbatim text; The Void's
 * is the owner-seen, parent-approved draft (owner may still edit wording).
 * Meadow lore law: zero em dashes, zero colons in this copy.
 */
export const CHARACTER_STORY_SECTIONS: Record<MeadowCharacterId, LegalModalSection> = {
  jq: {
    heading: 'CADET FILE',
    subheading: 'BOOSTER STARLING \u00b7 SPECIES UNKNOWN',
    paragraphs: [
      'Before there were maps, there were stories. The old ones say every star began as a story someone told into the dark, and that long before the first ships ever flew, there were beings who walked between worlds gathering those stories the way children gather fireflies. They were called Storytailor. No one has ever seen their faces. Some say they wove the first constellations by hand. Some say they only listen, and that listening is the whole secret. But wherever imagination burns, they are near, tending it like a fire that must never be allowed to go out.',
      'It was the Storytailor who founded O.R.B.I.T., a fellowship of cadets drawn from every corner of the sky. Not the strongest, and never the loudest. The ancient ones chose differently. They chose the ones who told stories to empty rooms, who built ships out of scrap and believed they would fly, who kept a light on for no reason anyone else could see.',
      'Which is how they found Booster.',
      'Booster grew up on a small planet most maps had already forgotten, where the nights were long and the stars felt closer than anyone else. There was no family to speak of, so Booster made one. Stories whispered to the dark. Little ships built from salvage and stubbornness. A promise, kept nightly, that somewhere up there someone was listening.',
      'Someone was.',
      'The recruiting officer never said how long the ancient ones had been watching. Only that the youngest cadet in the history of O.R.B.I.T. should probably stop crying and try on the suit. For a while, life was marching songs and missions, a patch worn proudly on one shoulder, and the particular happiness of belonging somewhere at last.',
      'Then something quiet moved through the stars. It did not roar or burn. It simply dimmed things, the way a room goes gray when a candle gutters, and when it had passed, the fellowship was gone. Every cadet, every teacher, every song. Except one.',
      'Booster was the one who kept going. The suit is scuffed now. The visor never opens, and no one has ever seen the face behind it. Maybe that is the point. Anyone could be Booster.',
      'They still hum the old marching songs when they think no one is listening. They still keep a pinch of meteorite dust from every world in one pocket, because the ancient ones taught that no story should be left behind. And between journeys they rest here, in the grass, under the sky, keeping the fire lit until the fellowship flies again.',
    ],
  },
  void: {
    heading: 'SUBJECT FILE',
    subheading: 'THE VOID \u00b7 SPECIES UNKNOWN',
    paragraphs: [
      'Somewhere before memory, when the universe was young and very loud, something small woke up in the dark between the stars. It had no name, no voice, and no one to ask about either. The old ones would come to call it The Void, but it never called itself anything at all.',
      'It found the universe overwhelming. Every world blazed and rang and shouted its stories into the sky, and nothing ever seemed to rest. So the small quiet thing did the only kind thing it knew. It began to hush things. A little less light here. A little less noise there. Wherever it passed, worlds went soft and gray and still, and it believed, truly believed, that it was helping.',
      'It did not notice what it took. It does not know that someone survived. It only knows that lately something strange keeps happening. It finds itself following brightness instead of hushing it. Hovering near warm windows. Tilting its head at songs it cannot sing. Reaching, very carefully, toward small drifting lights, and feeling something it has no word for when they glow.',
      'It has started to wonder if it is missing something.',
      'These nights it comes to a quiet meadow at the edge of the sky, where one light burns steady in the grass. It keeps its distance. It watches. And for reasons it cannot explain, it has not dimmed a single thing here.',
    ],
  },
};

/** Shared experience closing — unchanged from the shipped About. */
const ABOUT_CLOSING_SECTION: LegalModalSection = {
  paragraphs: [
    'This is a quiet meadow at the edge of the sky. There is nothing to win here and nothing to finish. You can walk, fly, gather the drifting lights, or just stand in the grass and listen to the wind.',
    'If you have smart lights at home, the room can drift along with the sky.',
    "Storytailor's Booster lives here. Stay as long as you like.",
  ],
};

/**
 * Character-aware About: current character's story first, the other's below it
 * (each with its own file-card header), then the shared closing. LegalModal
 * appends the [ PLAY WITH … ] inline switch action after the OTHER
 * character's section.
 */
export function getAboutModalContent(active: MeadowCharacterId): LegalModalContent {
  const other = otherMeadowCharacter(active);
  return {
    id: 'about',
    title: 'ABOUT',
    sections: [
      CHARACTER_STORY_SECTIONS[active],
      CHARACTER_STORY_SECTIONS[other],
      ABOUT_CLOSING_SECTION,
    ],
  };
}

export const LEGAL_MODAL_CONTENT: Record<LegalModalId, LegalModalContent> = {
  // Booster-first default; LegalModal swaps in getAboutModalContent(active).
  about: getAboutModalContent('jq'),
  terms: {
    id: 'terms',
    title: 'TERMS OF USE',
    lastUpdated: 'July 2026',
    sections: [
      {
        paragraphs: [
          'Storytailor® is a registered trademark of Storytailor Inc. Booster™ and the Booster character are property of Storytailor Inc.',
        ],
      },
      {
        heading: 'WHAT THIS IS',
        paragraphs: [
          "Booster's Meadow is a calm space made by Storytailor Inc. It is free, and no account is needed to use it.",
        ],
      },
      {
        heading: 'ACCOUNTS',
        paragraphs: [
          'If you connect smart lights or make a story, you will sign in with or create a free Storytailor account. Your account is governed by the Storytailor Terms of Service at storytailor.com/terms, which apply here too. Accounts are for adults. If a child uses the Meadow, a parent or guardian holds the account.',
        ],
      },
      {
        heading: 'VR MODE',
        paragraphs: [
          'VR mode follows your headset maker age guidance. It is optional and the flat meadow works the same without a headset.',
        ],
      },
      {
        heading: 'SMART LIGHTS',
        paragraphs: [
          'Connecting Philips Hue is optional. You can disconnect at any time from the lamp menu. Light effects are designed to change slowly, but you know your household best; if anyone in your home is sensitive to changing light, use the reduced lighting setting or keep lights disconnected.',
        ],
      },
      {
        heading: 'OURS AND YOURS',
        paragraphs: [
          'Booster, the characters, artwork, music, and design belong to Storytailor Inc. You may not copy, sell, or redistribute them. The Meadow is built in part on open-source software, credited in Attribution below.',
        ],
      },
      {
        heading: 'BE KIND TO THE MEADOW',
        paragraphs: [
          'Do not attempt to disrupt, reverse engineer, scrape, or misuse the experience or its services.',
        ],
      },
      {
        heading: 'NO PROMISES',
        paragraphs: [
          'The Meadow is provided as is. It is a place to rest, not a medical device, and it is not a substitute for professional care.',
        ],
      },
      {
        heading: 'CHANGES',
        paragraphs: [
          'We may update the Meadow and these terms. If we make meaningful changes, we will update the date above.',
        ],
      },
      {
        heading: 'QUESTIONS',
        paragraphs: ['hello@storytailor.com'],
      },
      {
        heading: 'ATTRIBUTION',
        paragraphs: [
          'Built on False Earth by Ming-Jyun Hung, used under the MIT License.',
          'Booster, all characters, artwork, and world design are property of Storytailor Inc.',
          'Original music composed and produced by JQ Sirls.',
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'PRIVACY',
    lastUpdated: 'July 2026',
    sections: [
      {
        paragraphs: ['The Meadow is built to ask for as little as possible.'],
      },
      {
        heading: 'WITHOUT AN ACCOUNT',
        paragraphs: [
          'We collect basic, anonymous usage information (visits, session length, device type) to keep the Meadow working well. That\'s it.',
        ],
      },
      {
        heading: 'WITH AN ACCOUNT',
        paragraphs: [
          'If you sign in or create a Storytailor account, we store your email and account details under the Storytailor Privacy Policy at storytailor.com/privacy.',
        ],
      },
      {
        heading: 'SMART LIGHTS',
        paragraphs: [
          'If you connect Philips Hue, we store the connection securely so your lights work next visit. We never see or control your lights outside the Meadow, and you can disconnect and delete the connection anytime from the lamp menu.',
        ],
      },
      {
        heading: 'CHILDREN',
        paragraphs: [
          'The Meadow collects no information about children. Ever. Accounts belong to adults.',
        ],
      },
      {
        heading: 'WE NEVER SELL YOUR DATA',
        paragraphs: ['No ads, no data sales, no exceptions.'],
      },
      {
        heading: 'QUESTIONS OR DELETION REQUESTS',
        paragraphs: ['hello@storytailor.com'],
      },
    ],
  },
  research: {
    id: 'research',
    title: 'RESEARCH',
    sections: [
      {
        paragraphs: [
          'The meadow is built on a small body of research about attention, play, and breath. It isn\u2019t treatment, and it doesn\u2019t claim to be. It\u2019s a quiet place, designed carefully. These are the ideas behind it.',
        ],
      },
      {
        heading: 'BUSY EYES, QUIETER MIND',
        paragraphs: [
          'When visual attention is absorbed by a rich spatial task, there is less room for looping, intrusive thoughts. Oxford researchers demonstrated this with, of all things, Tetris: absorbing visuospatial play measurably crowded out unwanted imagery. It\u2019s why the meadow gives your eyes grass, wind, and drifting light rather than menus.',
        ],
        citations: [
          {
            label: 'Holmes et al., 2009, PLOS ONE',
            url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0004153',
          },
          {
            label: 'Iyadurai et al., 2018',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5822451/',
          },
        ],
      },
      {
        heading: 'LOW-STAKES PLAY CALMS THE BODY, NOT JUST THE MOOD',
        paragraphs: [
          'Casual, unpressured games have been shown to reduce physiological stress: heart-rate variability improves, tension drops. Nothing in the meadow can be failed, lost, or done wrong.',
        ],
        citations: [
          {
            label: 'Russoniello, O\u2019Brien & Parks, 2009',
            url: 'https://doi.org/10.3233/978-1-60750-017-9-189',
          },
        ],
      },
      {
        heading: 'VIVID IMAGERY BEATS COUNTING SHEEP',
        paragraphs: [
          'People told to simply count fell asleep no faster than people told to do nothing; people who imagined an engaging, pleasant scene settled sooner. That\u2019s why the orbs drift and glow instead of stacking into a score.',
        ],
        citations: [
          {
            label: 'Harvey & Payne, 2002',
            url: 'https://doi.org/10.1016/s0005-7967(01)00012-2',
          },
        ],
      },
      {
        heading: 'GENTLE, REPETITIVE PLAY LIFTS MOOD QUICKLY',
        paragraphs: [
          'A recent Oxford study of a famously calm game found mood rises during play, with most of the benefit arriving in the first fifteen minutes. A short visit is enough; the meadow doesn\u2019t ask for more.',
        ],
        citations: [
          {
            label: 'University of Oxford, 2024',
            url: 'https://www.ox.ac.uk/news/2024-09-25-new-study-reveals-positive-mood-changes-during-video-game-play',
          },
        ],
      },
      {
        heading: 'SIX BREATHS A MINUTE',
        paragraphs: [
          'Breathing slowly, around six breaths per minute, reliably settles the nervous system. The orbs brighten and dim at that pace. If you find yourself breathing with them, that\u2019s the design working.',
        ],
        citations: [
          {
            label: 'Lehrer & Gevirtz, 2014, Frontiers in Psychology',
            url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00756/full',
          },
        ],
      },
      {
        heading: 'NO STREAKS, NO SCORES, NOTHING OWED',
        paragraphs: [
          'Decades of motivation research show that pressure and external rewards crowd out the quiet, self-chosen kind of engagement. So the count is a quiet readout that keeps to itself: it appears after your first gathered light, holds for the visit, and is forgotten when you leave. Nothing persists between visits, and the meadow never asks you to come back.',
        ],
        citations: [
          {
            label: 'Ryan & Deci, 2000',
            url: 'https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf',
          },
        ],
      },
      {
        paragraphs: ['That\u2019s the whole design. Stay as long as you like.'],
      },
    ],
  },
};
